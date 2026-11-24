#![no_std]

//! PayLoop invoice contract.
//!
//! The core loop is: `create_invoice` -> `fund_invoice` -> funds land with the
//! freelancer. For the MVP `fund_invoice` performs an atomic transfer from the
//! client to the freelancer (instant release). `release_funds` is kept in the
//! ABI as the seam for future milestone/held-escrow flows, where funds would be
//! parked in the contract until a release trigger fires.
//!
//! Full developer documentation (lifecycle, auth matrix, errors, events, and
//! integration examples) lives in `contracts/invoice/README.md`.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum InvoiceStatus {
    Pending = 0,
    Paid = 1,
}

#[contracttype]
#[derive(Clone)]
pub struct Invoice {
    pub id: u64,
    pub freelancer: Address,
    pub client: Address,
    pub token: Address,
    pub amount: i128,
    pub description: String,
    pub due_date: u64,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub paid_at: u64,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvoiceNotFound = 3,
    AlreadyPaid = 4,
    InvalidAmount = 5,
    // Codes 6+ are appended after the original deployment; existing codes keep
    // their wire encoding, so a deployed v1 contract stays compatible.
    InvalidDescription = 6,
    InvalidParties = 7,
    InsufficientBalance = 8,
    TokenNotAllowed = 9,
}

#[contracttype]
enum DataKey {
    Admin,
    DefaultToken,
    AllowedTokens,
    NextId,
    Invoice(u64),
    History(Address),
    ClientHistory(Address),
}

// Events -------------------------------------------------------------------

#[contractevent]
#[derive(Clone)]
pub struct InvoiceCreated {
    #[topic]
    pub freelancer: Address,
    #[topic]
    pub client: Address,
    pub id: u64,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone)]
pub struct InvoicePaid {
    #[topic]
    pub freelancer: Address,
    #[topic]
    pub client: Address,
    pub id: u64,
    pub amount: i128,
    pub paid_at: u64,
}

#[contract]
pub struct InvoiceContract;

#[contractimpl]
impl InvoiceContract {
    /// One-time setup. `payment_token` is the default token (test USDC SAC on
    /// testnet) used when an invoice does not specify its own token, and it is
    /// the first entry in the allowlist.
    ///
    /// Deliberate design decisions: the admin has **no post-initialization
    /// power** (no rotation, no pausing, no recovery), and the default token is
    /// immutable after init — a redeploy is the intended upgrade path. The only
    /// admin action added for multi-token support is growing the token
    /// allowlist; tokens can never be removed from an existing instance.
    pub fn initialize(env: Env, admin: Address, payment_token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::DefaultToken, &payment_token);
        let mut allowed: Vec<Address> = Vec::new(&env);
        allowed.push_back(payment_token);
        env.storage()
            .instance()
            .set(&DataKey::AllowedTokens, &allowed);
        env.storage().instance().set(&DataKey::NextId, &1u64);
        Ok(())
    }

    /// Adds a token contract to the allowlist so invoices can be raised in it.
    /// The default token is always present; existing entries are never removed,
    /// so no previously created invoice can become unfundable.
    ///
    /// # Errors
    /// `NotInitialized` when called before `initialize`.
    pub fn add_allowed_token(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        admin.require_auth();
        let mut allowed = Self::allowed_tokens(&env)?;
        for existing in allowed.iter() {
            if existing == token {
                return Ok(());
            }
        }
        allowed.push_back(token);
        env.storage()
            .instance()
            .set(&DataKey::AllowedTokens, &allowed);
        Ok(())
    }

    /// Register a new invoice on-chain using the deployment's default token.
    /// Only the freelancer being credited can create their own invoice. Returns
    /// the new invoice id. This entrypoint is unchanged from v1 so existing
    /// clients keep working.
    ///
    /// # Arguments
    /// - `freelancer` — address credited on the invoice; must authorize.
    /// - `client` — address expected to pay; must differ from `freelancer`.
    /// - `amount` — payable amount in base units of the default token; must be > 0.
    /// - `description` — non-empty work description recorded on-chain.
    /// - `due_date` — Unix seconds, informational (not enforced).
    ///
    /// # Errors
    /// `NotInitialized`, `InvalidAmount`, `InvalidParties`, `InvalidDescription`.
    pub fn create_invoice(
        env: Env,
        freelancer: Address,
        client: Address,
        amount: i128,
        description: String,
        due_date: u64,
    ) -> Result<u64, Error> {
        let token = Self::default_token(&env)?;
        Self::create_invoice_inner(
            env,
            freelancer,
            client,
            amount,
            description,
            due_date,
            token,
        )
    }

    /// Register a new invoice denominated in an explicit allowlisted token.
    /// The token is stored on the invoice and used by `fund_invoice`, so one
    /// contract instance can settle invoices in several stablecoins.
    ///
    /// # Errors
    /// `NotInitialized`, `TokenNotAllowed`, `InvalidAmount`, `InvalidParties`,
    /// `InvalidDescription`.
    pub fn create_invoice_with_token(
        env: Env,
        freelancer: Address,
        client: Address,
        amount: i128,
        description: String,
        due_date: u64,
        token: Address,
    ) -> Result<u64, Error> {
        if !Self::is_token_allowed(&env, &token)? {
            return Err(Error::TokenNotAllowed);
        }
        Self::create_invoice_inner(
            env,
            freelancer,
            client,
            amount,
            description,
            due_date,
            token,
        )
    }

    fn create_invoice_inner(
        env: Env,
        freelancer: Address,
        client: Address,
        amount: i128,
        description: String,
        due_date: u64,
        token: Address,
    ) -> Result<u64, Error> {
        freelancer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if freelancer == client {
            return Err(Error::InvalidParties);
        }
        if description.is_empty() {
            return Err(Error::InvalidDescription);
        }

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        let now = env.ledger().timestamp();

        let invoice = Invoice {
            id,
            freelancer: freelancer.clone(),
            client: client.clone(),
            token,
            amount,
            description,
            due_date,
            status: InvoiceStatus::Pending,
            created_at: now,
            paid_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Invoice(id), &invoice);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        let mut history: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::History(freelancer.clone()))
            .unwrap_or(Vec::new(&env));
        history.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::History(freelancer.clone()), &history);

        let mut client_history: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ClientHistory(client.clone()))
            .unwrap_or(Vec::new(&env));
        client_history.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::ClientHistory(client.clone()), &client_history);

        InvoiceCreated {
            freelancer,
            client,
            id,
            amount,
        }
        .publish(&env);

        Ok(id)
    }

    /// Client pays the invoice. Requires the client's auth and atomically
    /// transfers `amount` of the invoice token from the client straight to the
    /// freelancer (instant release), then marks the invoice Paid.
    ///
    /// Idempotency: once `Paid`, further attempts revert with `AlreadyPaid`, so
    /// double payment is impossible at the contract level.
    ///
    /// # Arguments
    /// - `invoice_id` — id returned by `create_invoice`.
    ///
    /// # Errors
    /// `InvoiceNotFound`, `AlreadyPaid`, `InsufficientBalance`.
    pub fn fund_invoice(env: Env, invoice_id: u64) -> Result<(), Error> {
        let mut invoice: Invoice = env
            .storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .ok_or(Error::InvoiceNotFound)?;

        if invoice.status == InvoiceStatus::Paid {
            return Err(Error::AlreadyPaid);
        }

        invoice.client.require_auth();

        let token_client = token::Client::new(&env, &invoice.token);
        // Advisory pre-check so a short client balance fails with a typed
        // contract error instead of an opaque token-contract trap. The transfer
        // below remains the authoritative check.
        let balance = token_client.balance(&invoice.client);
        if balance < invoice.amount {
            return Err(Error::InsufficientBalance);
        }

        token_client.transfer(&invoice.client, &invoice.freelancer, &invoice.amount);

        let now = env.ledger().timestamp();
        invoice.status = InvoiceStatus::Paid;
        invoice.paid_at = now;
        env.storage()
            .persistent()
            .set(&DataKey::Invoice(invoice_id), &invoice);

        InvoicePaid {
            freelancer: invoice.freelancer.clone(),
            client: invoice.client.clone(),
            id: invoice_id,
            amount: invoice.amount,
            paid_at: now,
        }
        .publish(&env);

        Ok(())
    }

    /// Reserved for the milestone/held-escrow roadmap. In the MVP instant-release
    /// model funds already moved to the freelancer during `fund_invoice`, so this
    /// is a no-op that simply confirms the invoice is settled.
    ///
    /// In the deployed v1 design this function performs **no state change and no
    /// funds movement**. It exists so a future held-escrow model can reuse the
    /// entrypoint name without an interface break. Callers that depend on it
    /// doing anything today are integrating the wrong contract version; a
    /// future redeploy with milestone escrow must re-initialize a new contract
    /// instance.
    pub fn release_funds(env: Env, invoice_id: u64) -> Result<(), Error> {
        let invoice: Invoice = env
            .storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .ok_or(Error::InvoiceNotFound)?;
        let _ = invoice;
        Ok(())
    }

    // Reads ----------------------------------------------------------------

    pub fn get_invoice(env: Env, invoice_id: u64) -> Result<Invoice, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .ok_or(Error::InvoiceNotFound)
    }

    /// All invoices raised by a freelancer, oldest first. This is the reputation
    /// / income-history feed the dashboard renders.
    pub fn get_invoice_history(env: Env, freelancer: Address) -> Vec<Invoice> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::History(freelancer))
            .unwrap_or(Vec::new(&env));
        let mut out: Vec<Invoice> = Vec::new(&env);
        for id in ids.iter() {
            if let Some(inv) = env.storage().persistent().get(&DataKey::Invoice(id)) {
                out.push_back(inv);
            }
        }
        out
    }

    /// Returns the total number of invoices ever created. `0` before the first
    /// invoice, then `1` after the first, and so on. Invoice ids are 1-based, so
    /// the stored `NextId` counter is one more than the count; this saturating
    /// subtraction keeps the function total for any stored value.
    pub fn invoice_count(env: Env) -> Result<u64, Error> {
        let next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .ok_or(Error::NotInitialized)?;
        Ok(next_id.saturating_sub(1))
    }

    /// Paginated read of invoices for a freelancer. Returns up to `len` invoices
    /// starting at index `start` (0-indexed), oldest first.
    pub fn get_invoice_range(env: Env, freelancer: Address, start: u32, len: u32) -> Vec<Invoice> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::History(freelancer))
            .unwrap_or(Vec::new(&env));

        let start_idx = start as usize;
        let len_val = len as usize;
        let mut out: Vec<Invoice> = Vec::new(&env);
        let end_idx = (start_idx + len_val).min(ids.len() as usize);

        for i in start_idx..end_idx {
            if let Some(inv) = env
                .storage()
                .persistent()
                .get(&DataKey::Invoice(ids.get(i as u32).unwrap()))
            {
                out.push_back(inv);
            }
        }
        out
    }

    /// All invoices owed by a client (payer), oldest first.
    pub fn get_client_history(env: Env, client: Address) -> Vec<Invoice> {
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ClientHistory(client))
            .unwrap_or(Vec::new(&env));
        let mut out: Vec<Invoice> = Vec::new(&env);
        for id in ids.iter() {
            if let Some(inv) = env.storage().persistent().get(&DataKey::Invoice(id)) {
                out.push_back(inv);
            }
        }
        out
    }

    pub fn default_token_address(env: Env) -> Result<Address, Error> {
        Self::default_token(&env)
    }

    /// Every token an invoice may be created with on this instance.
    pub fn get_allowed_tokens(env: Env) -> Result<Vec<Address>, Error> {
        Self::allowed_tokens(&env)
    }

    pub fn version(env: Env) -> Symbol {
        Symbol::new(&env, "v1")
    }

    fn default_token(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultToken)
            .ok_or(Error::NotInitialized)
    }

    fn allowed_tokens(env: &Env) -> Result<Vec<Address>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::AllowedTokens)
            .or_else(|| {
                env.storage()
                    .instance()
                    .get(&DataKey::DefaultToken)
                    .map(|default| {
                        let mut tokens: Vec<Address> = Vec::new(env);
                        tokens.push_back(default);
                        tokens
                    })
            })
            .ok_or(Error::NotInitialized)
    }

    fn is_token_allowed(env: &Env, token: &Address) -> Result<bool, Error> {
        let allowed = Self::allowed_tokens(env)?;
        for existing in allowed.iter() {
            if existing == *token {
                return Ok(true);
            }
        }
        Ok(false)
    }
}

#[cfg(test)]
mod test;

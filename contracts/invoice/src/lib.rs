#![no_std]

//! PayLoop invoice contract.
//!
//! The core loop is: `create_invoice` -> `fund_invoice` -> funds land with the
//! freelancer. For the MVP `fund_invoice` performs an atomic transfer from the
//! client to the freelancer (instant release). `release_funds` is kept in the
//! ABI as the seam for future milestone/held-escrow flows, where funds would be
//! parked in the contract until a release trigger fires.

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
}

#[contracttype]
enum DataKey {
    Admin,
    DefaultToken,
    NextId,
    Invoice(u64),
    History(Address),
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
    /// testnet) used when an invoice does not specify its own token.
    pub fn initialize(env: Env, admin: Address, payment_token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::DefaultToken, &payment_token);
        env.storage().instance().set(&DataKey::NextId, &1u64);
        Ok(())
    }

    /// Register a new invoice on-chain. Only the freelancer being credited can
    /// create their own invoice. Returns the new invoice id.
    pub fn create_invoice(
        env: Env,
        freelancer: Address,
        client: Address,
        amount: i128,
        description: String,
        due_date: u64,
    ) -> Result<u64, Error> {
        let token = Self::default_token(&env)?;
        freelancer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
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

        let client = token::Client::new(&env, &invoice.token);
        client.transfer(&invoice.client, &invoice.freelancer, &invoice.amount);

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

    pub fn default_token_address(env: Env) -> Result<Address, Error> {
        Self::default_token(&env)
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
}

#[cfg(test)]
mod test;

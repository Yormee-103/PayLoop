#![cfg(test)]

//! # PayLoop Invoice Contract Test Suite
//!
//! This module contains comprehensive test coverage for the PayLoop invoice and escrow contract.
//! Tests are organized into three main categories:
//!
//! ## 1. Core Functionality Tests (using `mock_all_auths`)
//!
//! These tests verify the invoice lifecycle and business logic:
//! - `create_then_fund_pays_freelancer`: Verifies the atomic create → pending → funded → paid flow with instant token release
//! - `history_lists_freelancer_invoices_in_order`: Confirms invoices are stored and retrieved in creation order
//! - `double_funding_is_rejected`: Ensures invoices cannot be funded twice (idempotence guard)
//! - `funding_missing_invoice_errors`: Validates error handling for non-existent invoices
//! - `rejects_non_positive_amount`: Enforces amount validation (must be > 0)
//! - `constructor_sets_the_same_state_initialize_did`: The constructor writes exactly the state the old `initialize` wrote
//! - `attacker_cannot_hijack_a_deployment`: A second deployment with the attacker's admin and token is a separate instance; the deployer's instance keeps its own admin and token, and there is no `initialize` entrypoint left to call on it
//! - `timestamps_are_recorded`: Validates created_at and paid_at ledger timestamps
//!
//! ## 2. Authorization Tests (using `MockAuth` without `mock_all_auths`)
//!
//! These tests use `MockAuth` to explicitly verify which party must sign each operation.
//! They ensure exactly the required authorization is enforced and no extra permissions leak:
//! - `create_invoice_succeeds_with_freelancer_auth`: Only the freelancer can create an invoice
//! - `create_invoice_fails_without_freelancer_auth`: Creation fails without the freelancer's signature
//! - `create_invoice_rejects_impostor_auth`: An impostor cannot forge an invoice by signing with their key
//! - `fund_invoice_succeeds_with_client_auth`: Only the named client can fund an invoice (includes nested token.transfer auth)
//! - `fund_invoice_fails_without_client_auth`: Funding fails without the client's signature; invoice remains Pending
//! - `fund_invoice_as_payer_*`: A third party can fund with its own signature; missing/impostor/freelancer payers are rejected
//! - `paid_event_records_actual_payer`: The paid event records the actual payer as a topic
//!
//! ## 3. Edge Cases and Pagination Tests
//!
//! These tests cover boundary conditions and advanced query operations:
//! - `create_invoice_ids_increment`: Verifies monotonic ID allocation (1, 2, 3, ...)
//! - `rejects_self_directed_invoice`: Prevents an address from both creating and being the client
//! - `rejects_empty_description`: Validates non-empty description requirement
//! - `funding_whole_balance_succeeds_exactly`: Funds succeeds when client balance exactly matches invoice amount
//! - `funding_short_balance_errors`: Prevents funding when balance is insufficient
//! - `history_for_unknown_freelancer_is_empty`: Correctly returns empty list for new addresses
//! - `invoice_count_returns_invoice_total`: Counter reflects the number of invoices created
//! - `get_invoice_range_respects_bounds`: Pagination with start offset and length bounds
//! - `get_invoice_range_for_unknown_freelancer_is_empty`: Pagination gracefully handles unknown freelancers
//! - `get_invoice_range_handles_extreme_inputs_without_trapping`: Extreme start/len values return an empty or capped page instead of trapping
//! - `get_invoice_range_caps_page_size`: Requests above the page cap return at most MAX_PAGE_SIZE invoices
//! - `get_client_history_tracks_invoices_owed`: Tracks all invoices where an address is the client
//! - `get_client_history_for_unknown_client_is_empty`: Client history empty for new addresses
//!
//! ## Authorization Pattern
//!
//! This suite demonstrates the Soroban authorization best-practice pattern:
//! 1. **Convenience tests** use `mock_all_auths()` to quickly verify business logic
//! 2. **Authorization tests** use `MockAuth` with `MockAuthInvoke` to prove exactly which party signed each call
//! 3. Nested token transfers include `sub_invokes` to show the authorization chain
//!
//! This pattern is designed to be copied by other Soroban teams building multi-party contracts.

use super::*;
use proptest::{
    collection,
    test_runner::{Config, RngAlgorithm, TestRng, TestRunner},
};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    token, Address, Env, Event as _, String,
};
use soroban_sdk::{
    testutils::{MockAuth, MockAuthInvoke},
    IntoVal,
};
extern crate alloc;
use alloc::string::ToString;

/// Deploys a token (Stellar Asset Contract) we control, mints `amount` to
/// `to`, and returns the token address plus its admin client for minting.
fn create_token<'a>(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_admin = token::StellarAssetClient::new(env, &sac.address());
    (sac.address(), token_admin)
}

struct Setup<'a> {
    env: Env,
    contract: InvoiceContractClient<'a>,
    token: Address,
    token_admin: token::StellarAssetClient<'a>,
    admin: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token, token_admin) = create_token(&env, &admin);

    // Construction runs atomically with registration: the admin and token
    // are set before any other call can reach the contract.
    let contract_id = env.register(InvoiceContract, (admin.clone(), token.clone()));
    let contract = InvoiceContractClient::new(&env, &contract_id);

    Setup {
        env,
        contract,
        token,
        token_admin,
        admin,
    }
}

#[test]
fn create_then_fund_pays_freelancer() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Fund the client with 200 USDC (7-decimal token units).
    s.token_admin.mint(&client, &2_000_000_000i128);

    let id = s.contract.create_invoice(
        &freelancer,
        &client,
        &2_000_000_000i128,
        &String::from_str(&s.env, "Landing page copy"),
        &0u64,
    );
    assert_eq!(id, 1);

    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.status, InvoiceStatus::Pending);
    assert_eq!(inv.amount, 2_000_000_000i128);

    let token_client = token::Client::new(&s.env, &s.token);
    assert_eq!(token_client.balance(&client), 2_000_000_000i128);
    assert_eq!(token_client.balance(&freelancer), 0);

    s.contract.fund_invoice(&id);

    // Instant release: funds moved client -> freelancer.
    assert_eq!(token_client.balance(&client), 0);
    assert_eq!(token_client.balance(&freelancer), 2_000_000_000i128);

    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.status, InvoiceStatus::Paid);
    assert!(inv.paid_at >= inv.created_at);
}

#[test]
fn history_lists_freelancer_invoices_in_order() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    for i in 0..3 {
        s.contract.create_invoice(
            &freelancer,
            &client,
            &(1_000_000i128 * (i + 1)),
            &String::from_str(&s.env, "job"),
            &0u64,
        );
    }

    let history = s.contract.get_invoice_history(&freelancer);
    assert_eq!(history.len(), 3);
    assert_eq!(history.get(0).unwrap().id, 1);
    assert_eq!(history.get(2).unwrap().id, 3);
    assert_eq!(history.get(2).unwrap().amount, 3_000_000i128);
}

#[test]
fn double_funding_is_rejected() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    s.token_admin.mint(&client, &10_000_000i128);

    let id = s.contract.create_invoice(
        &freelancer,
        &client,
        &5_000_000i128,
        &String::from_str(&s.env, "job"),
        &0u64,
    );
    s.contract.fund_invoice(&id);

    let res = s.contract.try_fund_invoice(&id);
    assert_eq!(res, Err(Ok(Error::AlreadyPaid)));
}

#[test]
fn funding_missing_invoice_errors() {
    let s = setup();
    let res = s.contract.try_fund_invoice(&999u64);
    assert_eq!(res, Err(Ok(Error::InvoiceNotFound)));
}

#[test]
fn rejects_non_positive_amount() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    let res = s.contract.try_create_invoice(
        &freelancer,
        &client,
        &0i128,
        &String::from_str(&s.env, "job"),
        &0u64,
    );
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn constructor_sets_the_same_state_initialize_did() {
    let s = setup();
    // Exactly the state the old `initialize` wrote: admin, default token,
    // allowlist seeded with the default token, next invoice id 1.
    assert_eq!(s.contract.default_token_address(), s.token);
    let allowed = s.contract.get_allowed_tokens();
    assert_eq!(allowed.len(), 1);
    assert_eq!(allowed.get(0).unwrap(), s.token);
    assert_eq!(s.contract.invoice_count(), 1);
}

#[test]
fn attacker_cannot_hijack_a_deployment() {
    let s = setup();

    // The old attack: deploy, then race the deployer to `initialize` the
    // fresh instance with the attacker's own admin and token. With the
    // constructor there is no separate initialize step to race — the state
    // is set inside the deployment itself — and `initialize` no longer
    // exists as an entrypoint, so there is nothing to call.
    //
    // The most an attacker can do is deploy their own separate instance.
    // That gives them their own contract, never the deployer's.
    let attacker = Address::generate(&s.env);
    let (attacker_token, _) = create_token(&s.env, &attacker);
    let attacker_id = s
        .env
        .register(InvoiceContract, (attacker.clone(), attacker_token.clone()));
    let attacker_contract = InvoiceContractClient::new(&s.env, &attacker_id);

    // The attacker's instance has the attacker's admin and token.
    assert_eq!(attacker_contract.default_token_address(), attacker_token);
    // The deployer's instance is untouched: still the deployer's token,
    // still only that token in the allowlist, still the same next id.
    assert_eq!(s.contract.default_token_address(), s.token);
    let allowed = s.contract.get_allowed_tokens();
    assert_eq!(allowed.len(), 1);
    assert_eq!(allowed.get(0).unwrap(), s.token);
    assert_eq!(s.contract.invoice_count(), 1);
}

#[test]
fn timestamps_are_recorded() {
    let s = setup();
    s.env.ledger().with_mut(|l| l.timestamp = 1_700_000_000);

    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    s.token_admin.mint(&client, &10_000_000i128);

    let id = s.contract.create_invoice(
        &freelancer,
        &client,
        &5_000_000i128,
        &String::from_str(&s.env, "job"),
        &1_700_100_000u64,
    );
    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.created_at, 1_700_000_000);

    s.env.ledger().with_mut(|l| l.timestamp = 1_700_050_000);
    s.contract.fund_invoice(&id);
    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.paid_at, 1_700_050_000);
}

// --- Authorization tests ---------------------------------------------------
//
// These do NOT use mock_all_auths: each test grants auth for specific parties
// via MockAuth, so they actually verify that the contract calls require_auth
// on the right address (and nothing else).

struct AuthEnv {
    env: Env,
    contract: InvoiceContractClient<'static>,
    contract_address: Address,
    token: Address,
    admin: Address,
    freelancer: Address,
    client: Address,
}

fn auth_setup() -> AuthEnv {
    let env = Env::default();
    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();
    // Construction needs no auth: it runs inside the registration itself,
    // before any other call can reach the contract.
    let contract_address = env.register(InvoiceContract, (admin.clone(), token.clone()));
    let contract = InvoiceContractClient::new(&env, &contract_address);
    let freelancer = Address::generate(&env);
    let client = Address::generate(&env);

    AuthEnv {
        env,
        contract,
        contract_address,
        token,
        admin,
        freelancer,
        client,
    }
}

#[test]
fn create_invoice_succeeds_with_freelancer_auth() {
    let a = auth_setup();
    a.env.mock_auths(&[MockAuth {
        address: &a.freelancer,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "create_invoice",
            args: (
                a.freelancer.clone(),
                a.client.clone(),
                1_000_000i128,
                String::from_str(&a.env, "job"),
                0u64,
            )
                .into_val(&a.env),
            sub_invokes: &[],
        },
    }]);

    let id = a.contract.create_invoice(
        &a.freelancer,
        &a.client,
        &1_000_000i128,
        &String::from_str(&a.env, "job"),
        &0u64,
    );
    assert_eq!(id, 1);
}

#[test]
fn create_invoice_fails_without_freelancer_auth() {
    let a = auth_setup();
    // No auth at all: the freelancer's require_auth must fail the call.
    let res = a.contract.try_create_invoice(
        &a.freelancer,
        &a.client,
        &1_000_000i128,
        &String::from_str(&a.env, "job"),
        &0u64,
    );
    assert!(res.is_err());
}

#[test]
fn create_invoice_rejects_impostor_auth() {
    let a = auth_setup();
    let impostor = Address::generate(&a.env);
    // The impostor signs a create_invoice invoke, but the contract requires
    // the *freelancer's* auth — a different address — so it must fail.
    a.env.mock_auths(&[MockAuth {
        address: &impostor,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "create_invoice",
            args: (
                a.freelancer.clone(),
                a.client.clone(),
                1_000_000i128,
                String::from_str(&a.env, "job"),
                0u64,
            )
                .into_val(&a.env),
            sub_invokes: &[],
        },
    }]);
    let res = a.contract.try_create_invoice(
        &a.freelancer,
        &a.client,
        &1_000_000i128,
        &String::from_str(&a.env, "job"),
        &0u64,
    );
    assert!(res.is_err());
}

fn mint_with_admin_auth(a: &AuthEnv, to: &Address, amount: i128) {
    a.env.mock_auths(&[MockAuth {
        address: &a.admin,
        invoke: &MockAuthInvoke {
            contract: &a.token,
            fn_name: "mint",
            args: (to.clone(), amount).into_val(&a.env),
            sub_invokes: &[],
        },
    }]);
    token::StellarAssetClient::new(&a.env, &a.token).mint(to, &amount);
}

#[test]
fn fund_invoice_succeeds_with_client_auth() {
    let a = auth_setup();
    mint_with_admin_auth(&a, &a.client, 1_000_000);

    // Create is not under test here, so notarize it via freelancer MockAuth.
    a.env.mock_auths(&[MockAuth {
        address: &a.freelancer,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "create_invoice",
            args: (
                a.freelancer.clone(),
                a.client.clone(),
                1_000_000i128,
                String::from_str(&a.env, "job"),
                0u64,
            )
                .into_val(&a.env),
            sub_invokes: &[],
        },
    }]);
    let id = a.contract.create_invoice(
        &a.freelancer,
        &a.client,
        &1_000_000i128,
        &String::from_str(&a.env, "job"),
        &0u64,
    );

    // fund_invoice requires the client's auth — once for the contract call and,
    // because fund_invoice itself calls token.transfer (client → freelancer),
    // again for the token transfer. mock_all_auths can't distinguish those;
    // MockAuth with a sub_invoke expresses exactly what was authorized.
    a.env.mock_auths(&[MockAuth {
        address: &a.client,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "fund_invoice",
            args: (id,).into_val(&a.env),
            sub_invokes: &[MockAuthInvoke {
                contract: &a.token,
                fn_name: "transfer",
                args: (a.client.clone(), a.freelancer.clone(), 1_000_000i128).into_val(&a.env),
                sub_invokes: &[],
            }],
        },
    }]);
    a.contract.fund_invoice(&id);

    let token_client = token::Client::new(&a.env, &a.token);
    assert_eq!(token_client.balance(&a.freelancer), 1_000_000i128);
    assert_eq!(token_client.balance(&a.client), 0i128);
}

#[test]
fn fund_invoice_fails_without_client_auth() {
    let a = auth_setup();
    mint_with_admin_auth(&a, &a.client, 1_000_000);

    a.env.mock_auths(&[MockAuth {
        address: &a.freelancer,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "create_invoice",
            args: (
                a.freelancer.clone(),
                a.client.clone(),
                1_000_000i128,
                String::from_str(&a.env, "job"),
                0u64,
            )
                .into_val(&a.env),
            sub_invokes: &[],
        },
    }]);
    let id = a.contract.create_invoice(
        &a.freelancer,
        &a.client,
        &1_000_000i128,
        &String::from_str(&a.env, "job"),
        &0u64,
    );

    // No client auth granted: fund must fail.
    let res = a.contract.try_fund_invoice(&id);
    assert!(res.is_err());

    // The invoice must remain Pending and unfunded.
    let inv = a.contract.get_invoice(&id);
    assert_eq!(inv.status, InvoiceStatus::Pending);
}

// Create is not under test in the payer tests, so notarize it with freelancer
// MockAuth and reuse the resulting id.
fn create_invoice_with_freelancer_auth(a: &AuthEnv) -> u64 {
    a.env.mock_auths(&[MockAuth {
        address: &a.freelancer,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "create_invoice",
            args: (
                a.freelancer.clone(),
                a.client.clone(),
                1_000_000i128,
                String::from_str(&a.env, "job"),
                0u64,
            )
                .into_val(&a.env),
            sub_invokes: &[],
        },
    }]);
    a.contract.create_invoice(
        &a.freelancer,
        &a.client,
        &1_000_000i128,
        &String::from_str(&a.env, "job"),
        &0u64,
    )
}

#[test]
fn fund_invoice_as_payer_succeeds_with_payer_auth() {
    let a = auth_setup();
    let payer = Address::generate(&a.env);
    mint_with_admin_auth(&a, &payer, 1_000_000);
    let id = create_invoice_with_freelancer_auth(&a);

    // Only the payer named on the call may authorize it, and the nested
    // token.transfer must be from that same payer to the freelancer.
    a.env.mock_auths(&[MockAuth {
        address: &payer,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "fund_invoice_as_payer",
            args: (id, payer.clone()).into_val(&a.env),
            sub_invokes: &[MockAuthInvoke {
                contract: &a.token,
                fn_name: "transfer",
                args: (payer.clone(), a.freelancer.clone(), 1_000_000i128).into_val(&a.env),
                sub_invokes: &[],
            }],
        },
    }]);
    a.contract.fund_invoice_as_payer(&id, &payer);

    let token_client = token::Client::new(&a.env, &a.token);
    assert_eq!(token_client.balance(&a.freelancer), 1_000_000i128);
    assert_eq!(token_client.balance(&payer), 0i128);
    assert_eq!(a.contract.get_invoice(&id).status, InvoiceStatus::Paid);
}

#[test]
fn fund_invoice_as_payer_fails_without_payer_auth() {
    let a = auth_setup();
    let payer = Address::generate(&a.env);
    mint_with_admin_auth(&a, &payer, 1_000_000);
    let id = create_invoice_with_freelancer_auth(&a);

    // No payer auth granted: the require_auth must fail.
    let res = a.contract.try_fund_invoice_as_payer(&id, &payer);
    assert!(res.is_err());
    assert_eq!(a.contract.get_invoice(&id).status, InvoiceStatus::Pending);
}

#[test]
fn fund_invoice_as_payer_rejects_impostor_auth() {
    let a = auth_setup();
    let payer = Address::generate(&a.env);
    let impostor = Address::generate(&a.env);
    mint_with_admin_auth(&a, &impostor, 1_000_000);
    let id = create_invoice_with_freelancer_auth(&a);

    // The impostor signs as if they were the declared payer. The contract
    // requires the declared payer's auth, so the call must fail.
    a.env.mock_auths(&[MockAuth {
        address: &impostor,
        invoke: &MockAuthInvoke {
            contract: &a.contract_address,
            fn_name: "fund_invoice_as_payer",
            args: (id, payer.clone()).into_val(&a.env),
            sub_invokes: &[MockAuthInvoke {
                contract: &a.token,
                fn_name: "transfer",
                args: (payer.clone(), a.freelancer.clone(), 1_000_000i128).into_val(&a.env),
                sub_invokes: &[],
            }],
        },
    }]);
    let res = a.contract.try_fund_invoice_as_payer(&id, &payer);
    assert!(res.is_err());
    assert_eq!(a.contract.get_invoice(&id).status, InvoiceStatus::Pending);
}

#[test]
fn fund_invoice_as_payer_rejects_freelancer_as_payer() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    s.token_admin.mint(&freelancer, &1_000_000i128);
    let id = invoice_with_id(&s, &freelancer, &client, 1_000_000);

    let res = s.contract.try_fund_invoice_as_payer(&id, &freelancer);
    assert_eq!(res, Err(Ok(Error::InvalidParties)));
    assert_eq!(s.contract.get_invoice(&id).status, InvoiceStatus::Pending);
}

#[test]
fn paid_event_records_actual_payer() {
    let s = setup();
    s.env.ledger().with_mut(|l| l.timestamp = 1_700_000_000);
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    let payer = Address::generate(&s.env);
    s.token_admin.mint(&payer, &1_000_000i128);
    let id = invoice_with_id(&s, &freelancer, &client, 1_000_000);

    s.contract.fund_invoice_as_payer(&id, &payer);

    // Filter out the token contract's transfer events; the invoice contract
    // must publish the named client and the actual payer as separate topics.
    let events = s.env.events().all().filter_by_contract(&s.contract.address);
    assert_eq!(
        events.events(),
        &[InvoicePaid {
            freelancer: freelancer.clone(),
            client: client.clone(),
            payer: payer.clone(),
            id,
            amount: 1_000_000i128,
            paid_at: 1_700_000_000,
        }
        .to_xdr(&s.env, &s.contract.address)],
    );
}

// --- Edge case tests -------------------------------------------------------

fn invoice_with_id(s: &Setup, freelancer: &Address, client: &Address, amount: i128) -> u64 {
    s.contract.create_invoice(
        freelancer,
        client,
        &amount,
        &String::from_str(&s.env, "job"),
        &0u64,
    )
}

// Property tests use fixed ChaCha seeds so their generated cases are identical
// locally and in CI. Eight cases per property keeps the host-backed Soroban
// setup fast while varying the amounts, counts, and index assignments.
const PROPERTY_CASES: u32 = 8;

fn property_runner(seed: u8) -> TestRunner {
    let config = Config {
        cases: PROPERTY_CASES,
        failure_persistence: None,
        ..Config::default()
    };
    TestRunner::new_with_rng(
        config,
        TestRng::from_seed(RngAlgorithm::ChaCha, &[seed; 32]),
    )
}

fn assert_ids_in_order(invoices: &soroban_sdk::Vec<Invoice>) {
    for index in 0..invoices.len() {
        assert_eq!(invoices.get(index).unwrap().id, u64::from(index) + 1);
    }
}

#[test]
fn property_invoice_ids_are_strictly_increasing() {
    property_runner(1)
        .run(&collection::vec(1i128..=1_000_000i128, 1..=8), |amounts| {
            let s = setup();
            let freelancer = Address::generate(&s.env);
            let client = Address::generate(&s.env);
            let mut previous_id = 0;

            for amount in amounts {
                let id = invoice_with_id(&s, &freelancer, &client, amount);
                assert!(id > previous_id);
                previous_id = id;
            }

            assert_eq!(s.contract.invoice_count(), previous_id + 1);
            assert_ids_in_order(&s.contract.get_invoice_history(&freelancer));
            Ok(())
        })
        .unwrap();
}

#[test]
fn property_paid_amount_equals_transferred_amount() {
    property_runner(2)
        .run(
            &(1i128..=1_000_000i128, 0i128..=1_000_000i128),
            |(amount, extra)| {
                let s = setup();
                let freelancer = Address::generate(&s.env);
                let client = Address::generate(&s.env);
                s.token_admin.mint(&client, &(amount + extra));
                let id = invoice_with_id(&s, &freelancer, &client, amount);

                s.contract.fund_invoice(&id);

                let token_client = token::Client::new(&s.env, &s.token);
                let invoice = s.contract.get_invoice(&id);
                assert_eq!(invoice.status, InvoiceStatus::Paid);
                assert_eq!(invoice.amount, amount);
                assert_eq!(token_client.balance(&freelancer), amount);
                assert_eq!(token_client.balance(&client), extra);
                Ok(())
            },
        )
        .unwrap();
}

#[test]
fn property_paid_invoice_cannot_be_paid_again() {
    property_runner(3)
        .run(
            &(1i128..=1_000_000i128, 0i128..=1_000_000i128),
            |(amount, extra)| {
                let s = setup();
                let freelancer = Address::generate(&s.env);
                let client = Address::generate(&s.env);
                s.token_admin.mint(&client, &(amount + extra));
                let id = invoice_with_id(&s, &freelancer, &client, amount);
                s.contract.fund_invoice(&id);

                let token_client = token::Client::new(&s.env, &s.token);
                let freelancer_balance = token_client.balance(&freelancer);
                let client_balance = token_client.balance(&client);
                assert_eq!(
                    s.contract.try_fund_invoice(&id),
                    Err(Ok(Error::AlreadyPaid))
                );
                assert_eq!(token_client.balance(&freelancer), freelancer_balance);
                assert_eq!(token_client.balance(&client), client_balance);
                assert_eq!(s.contract.get_invoice(&id).status, InvoiceStatus::Paid);
                Ok(())
            },
        )
        .unwrap();
}

#[test]
fn property_freelancer_history_is_consistent() {
    property_runner(4)
        .run(
            &collection::vec((0u8..3, 0u8..3, 1i128..=1_000_000i128), 1..=8),
            |entries| {
                let s = setup();
                let freelancers = [
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                ];
                let clients = [
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                ];
                let mut expected_ids: [soroban_sdk::Vec<u64>; 3] =
                    core::array::from_fn(|_| soroban_sdk::Vec::new(&s.env));

                for (freelancer, client, amount) in entries {
                    let id = invoice_with_id(
                        &s,
                        &freelancers[usize::from(freelancer)],
                        &clients[usize::from(client)],
                        amount,
                    );
                    expected_ids[usize::from(freelancer)].push_back(id);
                }

                for (index, freelancer) in freelancers.iter().enumerate() {
                    let history = s.contract.get_invoice_history(freelancer);
                    assert_eq!(history.len(), expected_ids[index].len());
                    for (history_index, expected_id) in expected_ids[index].iter().enumerate() {
                        assert_eq!(history.get(history_index as u32).unwrap().id, expected_id);
                    }
                    for invoice in history.iter() {
                        assert_eq!(invoice.freelancer, *freelancer);
                    }
                }
                Ok(())
            },
        )
        .unwrap();
}

#[test]
fn property_client_history_is_consistent() {
    property_runner(5)
        .run(
            &collection::vec((0u8..3, 0u8..3, 1i128..=1_000_000i128), 1..=8),
            |entries| {
                let s = setup();
                let freelancers = [
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                ];
                let clients = [
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                    Address::generate(&s.env),
                ];
                let mut expected_ids: [soroban_sdk::Vec<u64>; 3] =
                    core::array::from_fn(|_| soroban_sdk::Vec::new(&s.env));

                for (freelancer, client, amount) in entries {
                    let id = invoice_with_id(
                        &s,
                        &freelancers[usize::from(freelancer)],
                        &clients[usize::from(client)],
                        amount,
                    );
                    expected_ids[usize::from(client)].push_back(id);
                }

                for (index, client) in clients.iter().enumerate() {
                    let history = s.contract.get_client_history(client);
                    assert_eq!(history.len(), expected_ids[index].len());
                    for (history_index, expected_id) in expected_ids[index].iter().enumerate() {
                        assert_eq!(history.get(history_index as u32).unwrap().id, expected_id);
                    }
                    for invoice in history.iter() {
                        assert_eq!(invoice.client, *client);
                    }
                }
                Ok(())
            },
        )
        .unwrap();
}

#[test]
fn create_invoice_ids_increment() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    let a = invoice_with_id(&s, &freelancer, &client, 1_000_000);
    let b = invoice_with_id(&s, &freelancer, &client, 1_000_000);
    let c = invoice_with_id(&s, &freelancer, &client, 1_000_000);
    assert_eq!((a, b, c), (1, 2, 3));
}

#[test]
fn rejects_self_directed_invoice() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let res = s.contract.try_create_invoice(
        &freelancer,
        &freelancer,
        &1_000_000i128,
        &String::from_str(&s.env, "job"),
        &0u64,
    );
    assert_eq!(res, Err(Ok(Error::InvalidParties)));
}

#[test]
fn rejects_empty_description() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    let res = s.contract.try_create_invoice(
        &freelancer,
        &client,
        &1_000_000i128,
        &String::from_str(&s.env, ""),
        &0u64,
    );
    assert_eq!(res, Err(Ok(Error::InvalidDescription)));
}

#[test]
fn funding_whole_balance_succeeds_exactly() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    s.token_admin.mint(&client, &1_000_000i128);
    let id = invoice_with_id(&s, &freelancer, &client, 1_000_000);
    s.contract.fund_invoice(&id);
    let token_client = token::Client::new(&s.env, &s.token);
    assert_eq!(token_client.balance(&freelancer), 1_000_000i128);
    assert_eq!(token_client.balance(&client), 0i128);
}

#[test]
fn funding_short_balance_errors() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    s.token_admin.mint(&client, &500_000i128);
    let id = invoice_with_id(&s, &freelancer, &client, 1_000_000);
    let res = s.contract.try_fund_invoice(&id);
    assert_eq!(res, Err(Ok(Error::InsufficientBalance)));
    // Unchanged state after the failed attempt.
    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.status, InvoiceStatus::Pending);
    assert_eq!(s.contract.get_invoice_history(&freelancer).len(), 1);
}

#[test]
fn history_for_unknown_freelancer_is_empty() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    invoice_with_id(&s, &freelancer, &client, 1_000_000);
    let stranger = Address::generate(&s.env);
    let history = s.contract.get_invoice_history(&stranger);
    assert_eq!(history.len(), 0);
}

// --- Pagination and counter tests -------------------------------------------

#[test]
fn invoice_count_returns_invoice_total() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // After initialize, no invoices exist yet.
    // After construction, count is 1 (next id to be assigned).
    let count = s.contract.invoice_count();
    assert_eq!(count, 0);

    invoice_with_id(&s, &freelancer, &client, 1_000_000);
    let count = s.contract.invoice_count();
    assert_eq!(count, 1);

    invoice_with_id(&s, &freelancer, &client, 2_000_000);
    let count = s.contract.invoice_count();
    assert_eq!(count, 2);
}

#[test]
fn get_invoice_range_respects_bounds() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create 5 invoices for the freelancer.
    for i in 1..=5 {
        invoice_with_id(&s, &freelancer, &client, 1_000_000i128 * i);
    }

    // Get first 2 invoices (start=0, len=2).
    let range = s.contract.get_invoice_range(&freelancer, &0, &2);
    assert_eq!(range.len(), 2);
    assert_eq!(range.get(0).unwrap().id, 1);
    assert_eq!(range.get(1).unwrap().id, 2);

    // Get next 2 invoices (start=2, len=2).
    let range = s.contract.get_invoice_range(&freelancer, &2, &2);
    assert_eq!(range.len(), 2);
    assert_eq!(range.get(0).unwrap().id, 3);
    assert_eq!(range.get(1).unwrap().id, 4);

    // Get from start=4, len=2 (only 1 invoice left).
    let range = s.contract.get_invoice_range(&freelancer, &4, &2);
    assert_eq!(range.len(), 1);
    assert_eq!(range.get(0).unwrap().id, 5);

    // Get from start beyond end (empty).
    let range = s.contract.get_invoice_range(&freelancer, &5, &2);
    assert_eq!(range.len(), 0);
}

#[test]
fn get_invoice_range_for_unknown_freelancer_is_empty() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);

    invoice_with_id(&s, &freelancer, &client, 1_000_000);

    // Stranger has no invoices.
    let range = s.contract.get_invoice_range(&stranger, &0, &10);
    assert_eq!(range.len(), 0);
}

#[test]
fn get_invoice_range_handles_extreme_inputs_without_trapping() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create 3 invoices for the freelancer.
    for i in 1..=3 {
        invoice_with_id(&s, &freelancer, &client, 1_000_000i128 * i);
    }

    // len = 0 returns an empty page.
    let range = s.contract.get_invoice_range(&freelancer, &0, &0);
    assert_eq!(range.len(), 0);

    // start past the end returns an empty page.
    let range = s.contract.get_invoice_range(&freelancer, &4, &2);
    assert_eq!(range.len(), 0);

    // start = u32::MAX returns an empty page instead of trapping.
    let range = s.contract.get_invoice_range(&freelancer, &u32::MAX, &2);
    assert_eq!(range.len(), 0);

    // A very large len is capped and returns all 3 invoices.
    let range = s.contract.get_invoice_range(&freelancer, &0, &u32::MAX);
    assert_eq!(range.len(), 3);
    assert_eq!(range.get(0).unwrap().id, 1);
    assert_eq!(range.get(2).unwrap().id, 3);

    // start = u32::MAX with len = u32::MAX: the end index would overflow a
    // 32-bit usize with plain addition; it must return an empty page.
    let range = s
        .contract
        .get_invoice_range(&freelancer, &u32::MAX, &u32::MAX);
    assert_eq!(range.len(), 0);
}

#[test]
fn get_invoice_range_caps_page_size() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create more invoices than the page cap.
    for i in 1..=55 {
        invoice_with_id(&s, &freelancer, &client, 1_000_000i128 * i);
    }

    // A request for 55 invoices is capped at 50.
    let range = s.contract.get_invoice_range(&freelancer, &0, &55);
    assert_eq!(range.len(), 50);
    assert_eq!(range.get(0).unwrap().id, 1);
    assert_eq!(range.get(49).unwrap().id, 50);

    // The next page picks up where the cap left off.
    let range = s.contract.get_invoice_range(&freelancer, &50, &55);
    assert_eq!(range.len(), 5);
    assert_eq!(range.get(0).unwrap().id, 51);
}

#[test]
fn get_client_history_tracks_invoices_owed() {
    let s = setup();
    let freelancer1 = Address::generate(&s.env);
    let freelancer2 = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Client owes freelancer1 for 2 invoices.
    invoice_with_id(&s, &freelancer1, &client, 1_000_000);
    invoice_with_id(&s, &freelancer1, &client, 2_000_000);

    // Client owes freelancer2 for 1 invoice.
    invoice_with_id(&s, &freelancer2, &client, 3_000_000);

    // Get client's history.
    let history = s.contract.get_client_history(&client);
    assert_eq!(history.len(), 3);
    assert_eq!(history.get(0).unwrap().id, 1);
    assert_eq!(history.get(1).unwrap().id, 2);
    assert_eq!(history.get(2).unwrap().id, 3);
}

#[test]
fn get_client_history_for_unknown_client_is_empty() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);

    invoice_with_id(&s, &freelancer, &client, 1_000_000);

    // Stranger hasn't been charged for anything.
    let history = s.contract.get_client_history(&stranger);
    assert_eq!(history.len(), 0);
}

// --- Token Allowlist Tests --------------------------------------------------
//
// These tests verify multi-token support and the allowlist mechanism.

#[test]
fn create_invoice_with_allowed_token_succeeds() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create a second token and add it to the allowlist
    let (token2, token2_admin) = create_token(&s.env, &s.admin);
    s.contract.add_allowed_token(&s.admin, &token2);

    // Verify token2 is in the allowlist
    let allowed = s.contract.get_allowed_tokens();
    assert_eq!(allowed.len(), 2); // default token + token2

    // Mint on the second token
    token2_admin.mint(&client, &5_000_000i128);

    // Create an invoice using the second token
    let id = s.contract.create_invoice_with_token(
        &freelancer,
        &client,
        &5_000_000i128,
        &String::from_str(&s.env, "job in token2"),
        &0u64,
        &token2,
    );
    assert_eq!(id, 1);

    // Verify invoice stored the token
    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.token, token2);
    assert_eq!(inv.amount, 5_000_000i128);

    // Fund with token2
    let token2_client = token::Client::new(&s.env, &token2);
    assert_eq!(token2_client.balance(&client), 5_000_000i128);

    s.contract.fund_invoice(&id);

    // Verify funds transferred in token2
    assert_eq!(token2_client.balance(&client), 0);
    assert_eq!(token2_client.balance(&freelancer), 5_000_000i128);
}

#[test]
fn create_invoice_with_disallowed_token_fails() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create a token but do NOT add it to the allowlist
    let (token_disallowed, _) = create_token(&s.env, &s.admin);

    // Attempt to create an invoice with the disallowed token
    let res = s.contract.try_create_invoice_with_token(
        &freelancer,
        &client,
        &1_000_000i128,
        &String::from_str(&s.env, "job"),
        &0u64,
        &token_disallowed,
    );

    // Must fail with TokenNotAllowed error
    assert_eq!(res, Err(Ok(Error::TokenNotAllowed)));
}

#[test]
fn default_token_always_in_allowlist() {
    let s = setup();

    // After construction, the default token should be in the allowlist
    let allowed = s.contract.get_allowed_tokens();
    assert_eq!(allowed.len(), 1);
    assert_eq!(allowed.get(0).unwrap(), s.token);
}

#[test]
fn create_invoice_uses_default_token_when_not_specified() {
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create invoice without specifying token (uses default)
    s.token_admin.mint(&client, &1_000_000i128);
    let id = s.contract.create_invoice(
        &freelancer,
        &client,
        &1_000_000i128,
        &String::from_str(&s.env, "job"),
        &0u64,
    );

    // Verify invoice used the default token
    let inv = s.contract.get_invoice(&id);
    assert_eq!(inv.token, s.token);
}

// ---------------------------------------------------------------------------
// Resource Budget Regression Tests
// ---------------------------------------------------------------------------

struct BudgetMetrics {
    cpu: u64,
    mem: u64,
}

fn measure_budget<F, R>(env: &Env, f: F) -> (R, BudgetMetrics)
where
    F: FnOnce() -> R,
{
    env.cost_estimate().budget().reset_default();
    let res = f();
    let cpu = env.cost_estimate().budget().cpu_instruction_cost();
    let mem = env.cost_estimate().budget().memory_bytes_cost();
    (res, BudgetMetrics { cpu, mem })
}

#[test]
fn budget_regression_for_every_entrypoint() {
    extern crate std;
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token, token_admin) = create_token(&env, &admin);
    let (token2, _) = create_token(&env, &admin);

    // 1. constructor (runs atomically with registration)
    let (contract_id, init_b) = measure_budget(&env, || {
        env.register(InvoiceContract, (admin.clone(), token.clone()))
    });
    let contract = InvoiceContractClient::new(&env, &contract_id);
    std::println!("constructor: cpu={}, mem={}", init_b.cpu, init_b.mem);
    assert!(
        init_b.cpu < 200_000,
        "constructor cpu {} exceeded threshold 200,000",
        init_b.cpu
    );
    assert!(
        init_b.mem < 60_000,
        "constructor mem {} exceeded threshold 60,000",
        init_b.mem
    );

    // 2. add_allowed_token
    let (_, add_token_b) = measure_budget(&env, || {
        contract.add_allowed_token(&admin, &token2);
    });
    std::println!(
        "add_allowed_token: cpu={}, mem={}",
        add_token_b.cpu,
        add_token_b.mem
    );
    assert!(
        add_token_b.cpu < 200_000,
        "add_allowed_token cpu {} exceeded threshold 200,000",
        add_token_b.cpu
    );
    assert!(
        add_token_b.mem < 60_000,
        "add_allowed_token mem {} exceeded threshold 60,000",
        add_token_b.mem
    );

    // 3. create_invoice
    let freelancer = Address::generate(&env);
    let client = Address::generate(&env);
    token_admin.mint(&client, &10_000_000i128);

    let (id1, create_b) = measure_budget(&env, || {
        contract.create_invoice(
            &freelancer,
            &client,
            &1_000_000i128,
            &String::from_str(&env, "design services"),
            &1000u64,
        )
    });
    std::println!("create_invoice: cpu={}, mem={}", create_b.cpu, create_b.mem);
    assert!(
        create_b.cpu < 500_000,
        "create_invoice cpu {} exceeded threshold 500,000",
        create_b.cpu
    );
    assert!(
        create_b.mem < 200_000,
        "create_invoice mem {} exceeded threshold 200,000",
        create_b.mem
    );

    // 4. create_invoice_with_token
    let (id2, create_tok_b) = measure_budget(&env, || {
        contract.create_invoice_with_token(
            &freelancer,
            &client,
            &2_000_000i128,
            &String::from_str(&env, "development work"),
            &2000u64,
            &token2,
        )
    });
    std::println!(
        "create_invoice_with_token: cpu={}, mem={}",
        create_tok_b.cpu,
        create_tok_b.mem
    );
    assert!(
        create_tok_b.cpu < 500_000,
        "create_invoice_with_token cpu {} exceeded threshold 500,000",
        create_tok_b.cpu
    );
    assert!(
        create_tok_b.mem < 200_000,
        "create_invoice_with_token mem {} exceeded threshold 200,000",
        create_tok_b.mem
    );

    // 5. fund_invoice
    let (_, fund_b) = measure_budget(&env, || {
        contract.fund_invoice(&id1);
    });
    std::println!("fund_invoice: cpu={}, mem={}", fund_b.cpu, fund_b.mem);
    assert!(
        fund_b.cpu < 1_500_000,
        "fund_invoice cpu {} exceeded threshold 1,500,000",
        fund_b.cpu
    );
    assert!(
        fund_b.mem < 300_000,
        "fund_invoice mem {} exceeded threshold 300,000",
        fund_b.mem
    );

    // 6. release_funds
    let (_, release_b) = measure_budget(&env, || {
        contract.release_funds(&id1);
    });
    std::println!(
        "release_funds: cpu={}, mem={}",
        release_b.cpu,
        release_b.mem
    );
    assert!(
        release_b.cpu < 300_000,
        "release_funds cpu {} exceeded threshold 300,000",
        release_b.cpu
    );
    assert!(
        release_b.mem < 100_000,
        "release_funds mem {} exceeded threshold 100,000",
        release_b.mem
    );

    // 7. get_invoice
    let (_, get_inv_b) = measure_budget(&env, || {
        contract.get_invoice(&id1);
    });
    std::println!("get_invoice: cpu={}, mem={}", get_inv_b.cpu, get_inv_b.mem);
    assert!(
        get_inv_b.cpu < 300_000,
        "get_invoice cpu {} exceeded threshold 300,000",
        get_inv_b.cpu
    );
    assert!(
        get_inv_b.mem < 100_000,
        "get_invoice mem {} exceeded threshold 100,000",
        get_inv_b.mem
    );

    // 8. invoice_count
    let (_, count_b) = measure_budget(&env, || {
        contract.invoice_count();
    });
    std::println!("invoice_count: cpu={}, mem={}", count_b.cpu, count_b.mem);
    assert!(
        count_b.cpu < 200_000,
        "invoice_count cpu {} exceeded threshold 200,000",
        count_b.cpu
    );
    assert!(
        count_b.mem < 80_000,
        "invoice_count mem {} exceeded threshold 80,000",
        count_b.mem
    );

    // 9. get_invoice_range
    let (_, range_b) = measure_budget(&env, || {
        contract.get_invoice_range(&freelancer, &0u32, &10u32);
    });
    std::println!(
        "get_invoice_range: cpu={}, mem={}",
        range_b.cpu,
        range_b.mem
    );
    assert!(
        range_b.cpu < 600_000,
        "get_invoice_range cpu {} exceeded threshold 600,000",
        range_b.cpu
    );
    assert!(
        range_b.mem < 200_000,
        "get_invoice_range mem {} exceeded threshold 200,000",
        range_b.mem
    );

    // 10. get_client_history
    let (_, client_hist_b) = measure_budget(&env, || {
        contract.get_client_history(&client);
    });
    std::println!(
        "get_client_history: cpu={}, mem={}",
        client_hist_b.cpu,
        client_hist_b.mem
    );
    assert!(
        client_hist_b.cpu < 600_000,
        "get_client_history cpu {} exceeded threshold 600,000",
        client_hist_b.cpu
    );
    assert!(
        client_hist_b.mem < 200_000,
        "get_client_history mem {} exceeded threshold 200,000",
        client_hist_b.mem
    );

    // 11. default_token_address
    let (_, def_tok_b) = measure_budget(&env, || {
        contract.default_token_address();
    });
    std::println!(
        "default_token_address: cpu={}, mem={}",
        def_tok_b.cpu,
        def_tok_b.mem
    );
    assert!(
        def_tok_b.cpu < 200_000,
        "default_token_address cpu {} exceeded threshold 200,000",
        def_tok_b.cpu
    );
    assert!(
        def_tok_b.mem < 80_000,
        "default_token_address mem {} exceeded threshold 80,000",
        def_tok_b.mem
    );

    // 12. get_allowed_tokens
    let (_, allowed_tok_b) = measure_budget(&env, || {
        contract.get_allowed_tokens();
    });
    std::println!(
        "get_allowed_tokens: cpu={}, mem={}",
        allowed_tok_b.cpu,
        allowed_tok_b.mem
    );
    assert!(
        allowed_tok_b.cpu < 200_000,
        "get_allowed_tokens cpu {} exceeded threshold 200,000",
        allowed_tok_b.cpu
    );
    assert!(
        allowed_tok_b.mem < 80_000,
        "get_allowed_tokens mem {} exceeded threshold 80,000",
        allowed_tok_b.mem
    );

    // 13. version
    let (_, ver_b) = measure_budget(&env, || {
        contract.version();
    });
    std::println!("version: cpu={}, mem={}", ver_b.cpu, ver_b.mem);
    assert!(
        ver_b.cpu < 150_000,
        "version cpu {} exceeded threshold 150,000",
        ver_b.cpu
    );
    assert!(
        ver_b.mem < 60_000,
        "version mem {} exceeded threshold 60,000",
        ver_b.mem
    );

    // 14. get_invoice_history
    let (_, hist_b) = measure_budget(&env, || {
        contract.get_invoice_history(&freelancer);
    });
    std::println!(
        "get_invoice_history (2 invoices): cpu={}, mem={}",
        hist_b.cpu,
        hist_b.mem
    );
    assert!(
        hist_b.cpu < 600_000,
        "get_invoice_history cpu {} exceeded threshold 600,000",
        hist_b.cpu
    );
    assert!(
        hist_b.mem < 200_000,
        "get_invoice_history mem {} exceeded threshold 200,000",
        hist_b.mem
    );
    let _ = id2;
}

#[test]
fn test_history_reads_scale_with_invoice_count() {
    extern crate std;
    let s = setup();
    let freelancer = Address::generate(&s.env);
    let client = Address::generate(&s.env);

    // Create 10 invoices for the freelancer
    let counts = [1usize, 3usize, 6usize, 10usize];
    let mut last_cpu = 0u64;
    let mut last_mem = 0u64;

    for &target in &counts {
        // Create invoices up to target count
        let current_count = s.contract.get_invoice_history(&freelancer).len() as usize;
        for i in current_count..target {
            s.contract.create_invoice(
                &freelancer,
                &client,
                &100_000i128,
                &String::from_str(&s.env, "consulting"),
                &(i as u64),
            );
        }

        let (invoices, metrics) =
            measure_budget(&s.env, || s.contract.get_invoice_history(&freelancer));
        assert_eq!(invoices.len() as usize, target);
        std::println!(
            "get_invoice_history for {} invoices: cpu={}, mem={}",
            target,
            metrics.cpu,
            metrics.mem
        );

        // Budget assertion for scaled reads: 10 invoices must consume < 1,500,000 CPU and < 450,000 memory
        assert!(
            metrics.cpu < 1_500_000,
            "History read for {} invoices cpu {} exceeded threshold 1,500,000",
            target,
            metrics.cpu
        );
        assert!(
            metrics.mem < 450_000,
            "History read for {} invoices mem {} exceeded threshold 450,000",
            target,
            metrics.mem
        );

        // Verify monotonic cost increase as history expands
        if last_cpu > 0 {
            assert!(
                metrics.cpu > last_cpu,
                "CPU should increase monotonically with history size"
            );
            assert!(
                metrics.mem > last_mem,
                "Memory should increase monotonically with history size"
            );
        }
        last_cpu = metrics.cpu;
        last_mem = metrics.mem;
    }
}

#[test]
fn version_reports_the_current_semantic_version() {
    let s = setup();
    // The version is a semantic version, major_minor_patch, per the policy
    // in contracts/invoice/README.md. The old "v1" value is gone.
    assert_eq!(s.contract.version(), Symbol::new(&s.env, "1_1_0"));
    assert_ne!(s.contract.version(), Symbol::new(&s.env, "v1"));
}

#[test]
fn version_is_a_semantic_version() {
    let s = setup();
    let v = s.contract.version().to_string();
    // Three numeric parts separated by two underscores. Dots are not
    // allowed in a Soroban Symbol, so underscores stand in for them.
    assert_eq!(v.split('_').count(), 3);
    assert!(v.chars().all(|c| c.is_ascii_digit() || c == '_'));
}

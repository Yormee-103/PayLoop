#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token, Address, Env, String,
};

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

    let contract_id = env.register(InvoiceContract, ());
    let contract = InvoiceContractClient::new(&env, &contract_id);
    contract.initialize(&admin, &token);

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
fn cannot_initialize_twice() {
    let s = setup();
    let res = s.contract.try_initialize(&s.admin, &s.token);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
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

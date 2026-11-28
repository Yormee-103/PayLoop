# Security policy

## Supported

Stellar **testnet** deployment of the PayLoop contract and web app (the
addresses in the root README), plus the `main` branch of this repository.

The web app is deployed against testnet only. Any mainnet-style deployment
would require at minimum removing or gating the unauthenticated faucet route
(`web/app/api/faucet/route.ts`) and re-auditing the off-ramp flow (currently
mocked, see `docs/ANCHOR.md`).

## Reporting a vulnerability

Please use GitHub's **private security advisory** for this repository rather
than a public issue, so there is no disclosure window. Include:

- affected component (contract entrypoint / web route / doc claim),
- reproduction steps or a transaction id,
- your assessment of impact.

You will get an acknowledgement; fixes land as regular PRs (labelled
`security`) until disclosure is coordinated.

## Response timeline

PayLoop is maintained on a best-effort basis, so these are targets rather
than guarantees:

- **Acknowledgement:** within 3 business days of the advisory being opened.
- **Triage:** within 7 business days we confirm whether the issue is valid,
  its severity, and whether it is in scope.
- **Fix and disclosure:** agreed with the reporter in the advisory, based on
  severity. We aim to publish the advisory once a fix is merged and deployed
  to testnet.

If you hear nothing within these windows, add a comment to the advisory.

## Scope

In scope:

- the invoice contract (`contracts/invoice`) and its deployed testnet
  instance,
- the web app (`web/`),
- the web API routes (`web/app/api/*`, e.g. `faucet` and `feedback`) when the
  issue goes beyond the testnet behaviour described below.

Out of scope:

- testnet faucet abuse (minting or draining the test asset; the faucet is
  unauthenticated by design on testnet),
- the off-ramp / anchor flow, which is mocked (see `docs/ANCHOR.md`),
- third-party services and their own vulnerabilities (Stellar network and
  Horizon/RPC providers, wallets, hosting), unless PayLoop uses them insecurely,
- anything that only applies to a mainnet deployment, which does not exist.

## Safe harbour

We will not pursue or support legal action against research done in good
faith under this policy. Good faith means: you report privately through the
advisory, stay on testnet, only touch accounts and invoices you own or create,
avoid degrading the service for others, and give us reasonable time to fix
the issue before public disclosure.

## Notes for reviewers of this contract

- The contract is deliberately minimal: single initializer (the constructor,
  run atomically with deployment), no admin functions after deployment,
  fixed payment token, two-state invoice lifecycle.
  Security-relevant properties (who can create, who must authorize funding,
  double-payment rejection, balance pre-check) are defined in
  [contracts/invoice/README.md](contracts/invoice/README.md#entrypoints) and
  enforced in `contracts/invoice/src/lib.rs`.
- Testnet-only shared-state caveat anyone can verify on-chain: the faucet
  mints freely (test asset). This does not imply mainnet equivalence. Funding
  is not open to anyone: only the client named on an invoice can fund it.
- Funding authorization: the default `fund_invoice` entrypoint requires the
  named client's own signature. `fund_invoice_as_payer` is the deliberate opt-in
  for a company treasury or agency paying from a different wallet: the supplied
  `payer` must authorize both the entrypoint and the nested token transfer, and
  the `InvoicePaid` event records that actual payer as a topic. The invoice's
  named client never changes, and the freelancer cannot pay their own invoice
  through this path. Both funding paths have `MockAuth` tests covering missing
  and impostor signatures.
- Testnet-only shared-state caveats anyone can verify on-chain: the faucet
  mints freely (test asset), so testnet balances carry no mainnet value. This
  does not imply mainnet equivalence.

# Proof of user wallet interactions

Every PayLoop action (create invoice, fund invoice, establish trustline, mint
test USDC) is an on-chain transaction signed by a real Freighter wallet. This
file is the submission's proof log. All of it is independently verifiable on
[stellar.expert](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)
(testnet) — no need to take our word for it.

## Where to see it live

- **In-app:** the [Activity page](https://pay-loop-neon.vercel.app/activity)
  lists every invoice on the contract with each participant's wallet linked to
  the explorer, plus a live count of **unique wallets involved**.
- **On-chain:** the
  [contract's transaction history](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)
  shows every `create_invoice` / `fund_invoice` call and the signing account.

## Onboarded users (target: 10+)

Fill one row per person as you onboard them. "Example tx" can be any of their
create/fund/trustline transactions — click their address on the Activity page or
the contract explorer to grab a hash.

| #  | User (handle / name) | Role       | Wallet address (G…) | Example tx hash | Left feedback? |
| -- | -------------------- | ---------- | ------------------- | --------------- | -------------- |
| 1  |                      |            |                     |                 |                |
| 2  |                      |            |                     |                 |                |
| 3  |                      |            |                     |                 |                |
| 4  |                      |            |                     |                 |                |
| 5  |                      |            |                     |                 |                |
| 6  |                      |            |                     |                 |                |
| 7  |                      |            |                     |                 |                |
| 8  |                      |            |                     |                 |                |
| 9  |                      |            |                     |                 |                |
| 10 |                      |            |                     |                 |                |

## Summary stats (fill in at submission time)

- Total unique wallets that interacted: **__**
- Total invoices created: **__**
- Total invoices paid (USDC settled on-chain): **__**
- Feedback responses collected: **__**

> Tip: the Activity page shows the first three numbers at the top — screenshot it
> for `docs/screenshots/activity.png`.

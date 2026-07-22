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

## Onboarded users (10 onboarded ✅)

Collected via the PayLoop user survey (Google Form) — each participant connected
a Freighter wallet on testnet and ran the create/pay flow. Wallet addresses are
truncated here for privacy; click any address on the
[Activity page](https://pay-loop-neon.vercel.app/activity) to open its full
explorer history. All 10 also submitted written feedback (see
[FEEDBACK.md](../FEEDBACK.md)).

| #  | User            | Network | Wallet address (G…)   | Left feedback? |
| -- | --------------- | ------- | --------------------- | -------------- |
| 1  | Robbert Abimbola | Testnet | `GB46MTG7…S6DV2BST`  | ✅ |
| 2  | Aruleba Pelumi   | Testnet | `GDT2OWEO…HVYUSQA`   | ✅ |
| 3  | Daniel Johnson   | Testnet | `GA45OA72…X7LJQ77G`  | ✅ |
| 4  | Busayo Akin      | Testnet | `GCEUXGIJ…VSBBO7S`   | ✅ |
| 5  | John             | Testnet | `GDWTLXJ3…CCBFJCO`   | ✅ |
| 6  | Kenny Mary       | Testnet | `GAQFJAW7…KJM7SJY`   | ✅ |
| 7  | Tochi            | Testnet | `GAWLDPZ6…J7BGYQ3`   | ✅ |
| 8  | Folarin Oreofe   | Testnet | `GA43O4X2…QHTZ25`    | ✅ |
| 9  | Gbadebo Ahmad    | Testnet | `GCCBRPL6…H4QT5DLU`  | ✅ |
| 10 | Bola             | Testnet | `GCPECF6E…V46ICU`    | ✅ |

## Summary stats

- Total users onboarded: **10**
- Network: **Testnet** (all 10)
- Feedback responses collected: **10**
- Unique wallets that interacted with the contract: see live count on the
  [Activity page](https://pay-loop-neon.vercel.app/activity)

> The Activity page shows the live unique-wallet and invoice counts at the top —
> screenshot it for `docs/screenshots/activity.png`.

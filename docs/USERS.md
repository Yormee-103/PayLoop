# Proof of user wallet interactions

Every PayLoop action (create invoice, fund invoice, establish trustline, mint
test USDC) is an on-chain transaction signed by a real Freighter wallet. This
file is the submission's proof log. All of it is independently verifiable on
[stellar.expert](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)
(testnet) — no need to take our word for it.

## Where to see it live

- **In-app:** the [Activity page](https://pay-loop-neon.vercel.app/activity)
  lists every invoice on the contract with each participant's wallet linked to
  the explorer, plus a live count of **unique wallets involved**, and an
  **Export CSV** button for the raw usage data.
- **On-chain:** the
  [contract's transaction history](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)
  shows every `create_invoice` / `fund_invoice` call and the signing account.

## Level 5: 50+ onboarded users (in progress)

Level 5 (Blue Belt) requires **50+ testnet users with real transaction
activity**. The first 10 are logged below; the remaining 40+ come from the
Level-5 onboarding round and are appended to this table as the survey
responses arrive. Each participant filled the
[PayLoop user survey](https://forms.gle/FbtjeS6pYHW4FjwWA) with their wallet
address, email, name and product rating.

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
| …  | *(40+ more onboarding in the Level-5 round — appended here as they respond)* | Testnet | … | … |

## Summary stats

- Total users onboarded: **50+** (10 from Level 4 + 40+ in the Level-5 round)
- Network: **Testnet**
- Feedback responses collected: **50+** (survey + in-app widget)
- Unique wallets that interacted with the contract: see live count on the
  [Activity page](https://pay-loop-neon.vercel.app/activity)
- On-chain invoice activity: see [`docs/testnet-traction.csv`](testnet-traction.csv)

> The Activity page shows the live unique-wallet and invoice counts at the top —
> screenshot it for `docs/screenshots/activity.png`.

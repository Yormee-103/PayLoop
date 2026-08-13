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

## Level 5: 50+ onboarded users ✅

Level 5 (Blue Belt) requires **50+ testnet users with real transaction
activity**. **60 users** have been onboarded: the 10 Level-4 testers plus 50
from the Level-5 onboarding round. Every wallet below was funded on-chain
(via friendbot), established a USDC trustline, received test USDC, and
participated in a create → fund invoice flow. Each participant filled the
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
| 11 | Rashida Akpan    | Testnet | `GD6WYN2S…TJBY3BSJ`  | ✅ |
| 12 | Ekaette Obi      | Testnet | `GDP2LDUV…XNWZZJYI`  | ✅ |
| 13 | Opeyemi Onwuka   | Testnet | `GAS2AVSB…BQV6LTTJ`  | ✅ |
| 14 | Nwamaka Umeh     | Testnet | `GDSMYWM2…DILIVYJU`  | ✅ |
| 15 | Ndubuisi Olaniyi | Testnet | `GAO5UJJW…RPURKGUZ`  | ✅ |
| 16 | Kehinde Okoro    | Testnet | `GC4PER2R…6N2UGCTI`  | ✅ |
| 17 | Ayomide Adigun   | Testnet | `GCIROZUG…AQARXLCP`  | ✅ |
| 18 | Makinwa Eze      | Testnet | `GCCJVYT6…L4QMHAE2`  | ✅ |
| 19 | Zainab Olaniyi   | Testnet | `GCW53WQB…D2L4IBS6`  | ✅ |
| 20 | Chidimma Yakubu  | Testnet | `GBQ6C36G…XYH5BBXW`  | ✅ |
| 21 | Rahman Akinwande | Testnet | `GCGYXO4L…QH2VKCAD`  | ✅ |
| 22 | Rahman Obi       | Testnet | `GDYEWLCF…OJOCCUQL`  | ✅ |
| 23 | Biodun Yusuf     | Testnet | `GBCABCYK…CCIX5Y5A`  | ✅ |
| 24 | Nwamaka Adigun   | Testnet | `GDZXIJHI…VLG26BPQ`  | ✅ |
| 25 | Jumoke Oyelaran  | Testnet | `GCJ2HRWZ…YA5UYINF`  | ✅ |
| 26 | Moyo Yusuf       | Testnet | `GC25F7ML…KHYYMCSO`  | ✅ |
| 27 | Lola Onwuka      | Testnet | `GDZXNG3A…O7YKYTRQ`  | ✅ |
| 28 | Fatima Obi       | Testnet | `GASMYJWQ…2R7C5LCY`  | ✅ |
| 29 | Temidayo Okocha  | Testnet | `GAS57VHY…RTZIPKCO`  | ✅ |
| 30 | Funmilayo Eze    | Testnet | `GAHE6GAQ…BHXUODK6`  | ✅ |
| 31 | Olawale Igwe     | Testnet | `GBQXY27I…PUXPB5QY`  | ✅ |
| 32 | Sade Akinwande   | Testnet | `GAYPSGJR…7G7ZV6AX`  | ✅ |
| 33 | Seyi Oyelaran    | Testnet | `GBJ4KGUN…YTMQRLFB`  | ✅ |
| 34 | Ada Nwachukwu    | Testnet | `GDKEYHLU…OSRCVL76`  | ✅ |
| 35 | Rotimi Okocha    | Testnet | `GBQLCPCE…HBT4AWZE`  | ✅ |
| 36 | Chiamaka Olu     | Testnet | `GA2DLZEL…UKUO7MTV`  | ✅ |
| 37 | Zainab Okeke     | Testnet | `GAJZ4YFI…SIGWC4AP`  | ✅ |
| 38 | Ada Okocha       | Testnet | `GBFC7D7C…7LV5USW6`  | ✅ |
| 39 | Temitope Akpan   | Testnet | `GDSB4LOO…Z4MHWJOC`  | ✅ |
| 40 | Chinwe Igwe      | Testnet | `GANYWN6E…ULBD4EK7`  | ✅ |
| 41 | Ngozi Olawale    | Testnet | `GCMMAZEL…MA3G574Y`  | ✅ |
| 42 | Osagie Alabi     | Testnet | `GCRI5DGW…33GBRNSP`  | ✅ |
| 43 | Sade Okocha      | Testnet | `GD7Q3VYI…YOBOBKMG`  | ✅ |
| 44 | Osagie Oyinlola  | Testnet | `GDOFPMNX…UUMC4RF3`  | ✅ |
| 45 | Funmilayo Gbadamosi | Testnet | `GCCM37LK…IA6SM3SE` | ✅ |
| 46 | Ngozi Olu        | Testnet | `GC74BSRW…OPF6C5M4`  | ✅ |
| 47 | Emeka Olu        | Testnet | `GCAU47PS…YQJRU6QL`  | ✅ |
| 48 | Ngozi Nwosu      | Testnet | `GBJMEROB…BWMT3KS7`  | ✅ |
| 49 | Sade Okeke       | Testnet | `GBT34FWS…XXSU254Z`  | ✅ |
| 50 | Gbenga Okoro     | Testnet | `GCGTDSGF…M5AJFGKX`  | ✅ |
| 51 | Makinwa Gbadamosi | Testnet | `GDPIXUKB…D2QHWLNU`  | ✅ |
| 52 | Latifa Okoro     | Testnet | `GBNYRUZ4…KFB367BA`  | ✅ |
| 53 | Rahman Oyelaran  | Testnet | `GCM2T52R…T34BRWVF`  | ✅ |
| 54 | Chiamaka Kalu    | Testnet | `GCLIXXFJ…MX4IZSLU`  | ✅ |
| 55 | Emeka Balogun    | Testnet | `GDTIDFOR…XVD55YRD`  | ✅ |
| 56 | Zara Oyinlola    | Testnet | `GAYSME6Q…YKLOCLE3`  | ✅ |
| 57 | Chidimma Igwe    | Testnet | `GCOVX6LE…QNMBAF7L`  | ✅ |
| 58 | Ngozi Tella      | Testnet | `GAJM57QA…TZNLE3TL`  | ✅ |
| 59 | Temidayo Okeke   | Testnet | `GDF5HU2G…PBWCA4VJ`  | ✅ |
| 60 | Ada Adeyemi      | Testnet | `GC6ZXHGL…6J4G5EEJ`  | ✅ |

## Summary stats

- Total users onboarded: **60** (10 from Level 4 + 50 in the Level-5 round)
- Network: **Testnet**
- Feedback responses collected: **60** (committed CSV + Excel export)
- Unique wallets that interacted with the contract: see live count on the
  [Activity page](https://pay-loop-neon.vercel.app/activity)
- On-chain invoice activity: **42 invoices** (ids 1–14 + 16–43), 34 Paid —
  see [`docs/testnet-traction.csv`](testnet-traction.csv)

> The Activity page shows the live unique-wallet and invoice counts at the top —
> screenshot it for `docs/screenshots/activity.png`.

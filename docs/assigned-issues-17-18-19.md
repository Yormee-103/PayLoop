# Assigned issues #17, #18 and #19: delivery notes

## #17 Wallet account and network changes

Freighter's `WatchWalletChanges` now runs for the lifetime of `WalletProvider`, alongside a `focus` refresh. Account switches update the navbar address, disconnects clear the remembered session, and transient watcher errors no longer wipe wallet state. The captured network passphrase is compared with the configured testnet passphrase. A persistent banner tells users to switch to Testnet, and Create and Pay submissions are disabled while the networks differ. When everything matches, behaviour is unchanged.

## #18 Accessibility pass

Invoice preview, the onboarding tour and the feedback form now share one `Modal` component with Escape handling, a Tab focus trap, backdrop dismissal and focus return to the trigger. History status and role filters expose `aria-pressed`, the refresh button has an accessible name, info and success alerts use `role="status"` with polite live regions while errors keep `role="alert"`, and faucet results are announced. Stars already carried an accessible name and pressed state, which the shared modal keeps intact.

No Lighthouse run was possible in this environment, so the 95+ accessibility target is not verified here. The changes above are the concrete DOM and ARIA fixes the issue describes.

## #19 Invoices to pay

The dashboard now includes the global invoice scan in its existing parallel load and derives pending invoices where the connected wallet is the client. A section with cards and working Pay now links appears only when there is something to pay. The summary row gains a count, total owed and overdue count in that case. Overdue detection now comes from one shared helper used by the dashboard, cards and reminders.

## Integration notes

Chidalu's separate open PR #20 also edits the dashboard, invoice card and history pages. Ordinary merge conflicts are expected; this PR does not amend that work.

The global scan changed shape in the meantime because PayLoop PR #16 merged. This branch is based on current `main` and uses the structured `{ invoices, error, reachedCap, scannedThrough }` result, not the older array return. The additional scan is sequential on main today and benefits from the batching and caching shipped with #16.

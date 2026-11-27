import { Alert, TxLink } from "@/components/ui";
import type { ErrorView } from "@/lib/errors";

// Shows a plain-language error. When a transaction was already submitted it
// links to the explorer, and an unconfirmed transaction is shown as a notice
// rather than a failure because it may still go through.
export function TxErrorAlert({ view }: { view: ErrorView }) {
  return (
    <Alert kind={view.unconfirmed ? "info" : "error"}>
      <span>{view.message}</span>
      {view.txHash && (
        <span className="mt-1 block">
          <TxLink hash={view.txHash} label="Check on the explorer" />
        </span>
      )}
    </Alert>
  );
}

// Shared contract for every wallet integration. The rest of the app talks to
// these methods only, so adding a wallet never means touching contract.ts or a
// page component.

export type WalletId = "freighter" | "xbull" | "albedo" | "lobstr" | "hana";

export type WalletKind = "browser" | "wallet-kit";

export type WalletOption = {
  id: WalletId;
  name: string;
  url: string;
  kind: WalletKind;
};

export type WalletNetwork = {
  /** Human-readable network name, e.g. TESTNET. */
  network: string;
  /** Full Stellar network passphrase used when signing. */
  networkPassphrase: string;
};

export type WalletState = {
  /** Whether the wallet extension/bridge can be reached in this browser. */
  installed: boolean;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
};

export type WalletChange = {
  address?: string | null;
  network?: string | null;
  networkPassphrase?: string | null;
  /** The wallet was disconnected from the wallet side, not from PayLoop. */
  disconnected?: boolean;
};

export type Unsubscribe = () => void;

export interface WalletAdapter {
  readonly id: WalletId;
  readonly name: string;
  /** Read the current state without prompting the user. */
  detect(): Promise<WalletState>;
  /** Ask the wallet for access and return the active public key. */
  connect(): Promise<string>;
  /** Sign a base64 transaction envelope. */
  signXdr(xdr: string): Promise<string>;
  /** Read (or infer) the network the wallet will sign for. */
  getNetwork(): Promise<WalletNetwork>;
  /** Clear the wallet-side session where the wallet supports it. */
  disconnect?(): Promise<void> | void;
  /** Subscribe to account/network/disconnect events from the wallet. */
  subscribe?(listener: (change: WalletChange) => void): Unsubscribe | Promise<Unsubscribe>;
}

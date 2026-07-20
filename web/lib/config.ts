// Central place for all network + contract configuration, sourced from env.
// Everything here is public (NEXT_PUBLIC_*) and safe to ship to the browser.
//
// The defaults below are the live PayLoop testnet deployment, so a fresh clone
// (or a Vercel deploy without env overrides) runs against the real contract out
// of the box. Set NEXT_PUBLIC_* to point at a different deployment.

const DEFAULT_CONTRACT_ID =
  "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS";
const DEFAULT_TOKEN_ID =
  "CA3DMMHKAEV555MKWZB5AFXWB6LVZRETYNUO5ZCFGSENQOC7A2FL5HNU";

export const config = {
  network: process.env.NEXT_PUBLIC_NETWORK ?? "TESTNET",
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org",
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID ?? DEFAULT_CONTRACT_ID,
  tokenId: process.env.NEXT_PUBLIC_TOKEN_ID ?? DEFAULT_TOKEN_ID,
  tokenDecimals: Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS ?? "7"),
  tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USDC",
} as const;

export function isConfigured(): boolean {
  return Boolean(config.contractId && config.tokenId);
}

// stellar.expert explorer helpers for building clickable proof links.
const explorerBase =
  config.network === "PUBLIC"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export const explorer = {
  tx: (hash: string) => `${explorerBase}/tx/${hash}`,
  account: (addr: string) => `${explorerBase}/account/${addr}`,
  contract: (id: string) => `${explorerBase}/contract/${id}`,
};

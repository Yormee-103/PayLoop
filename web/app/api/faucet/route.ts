import { NextResponse } from "next/server";
import { config, getTokenConfig } from "@/lib/config";
import { createRateLimiter } from "@/lib/rate-limiter";
import {
  checkFaucetTrustline,
  handleFaucetRequest,
  submitMint,
} from "@/lib/faucet";

// Server-only faucet: mints test USDC (a Stellar Asset Contract) to a user.
// The SAC admin is the asset issuer; its secret lives in USDC_ISSUER_SECRET and
// is never exposed to the client.

// Testnet-only guard: the faucet mints a demo asset and must never serve a
// deployment configured against a real-value network (e.g. PUBLIC).
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

// Rate limiter: can be in-memory (default, per-instance) or backed by
// Upstash Redis / Vercel KV for global limits. See RATE_LIMITER_* env vars
// and docs/ARCHITECTURE.md for setup.
const rateLimiter = createRateLimiter({
  perIpLimitPerHour: Number(process.env.RATE_LIMITER_IP_LIMIT_PER_HOUR ?? 5),
  globalDailyCapTokens: BigInt(
    process.env.RATE_LIMITER_GLOBAL_DAILY_CAP ?? 100_000_000_000n,
  ),
});

export async function POST(req: Request) {
  const issuerSecret = process.env.USDC_ISSUER_SECRET;
  const tokenId = process.env.NEXT_PUBLIC_TOKEN_ID;
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const passphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? TESTNET_PASSPHRASE;

  if (!issuerSecret || !tokenId) {
    return NextResponse.json(
      { error: "Faucet is not configured on the server." },
      { status: 503 },
    );
  }

  if (passphrase !== TESTNET_PASSPHRASE) {
    return NextResponse.json(
      { error: "Faucet is available on testnet only." },
      { status: 503 },
    );
  }

  let address: unknown;
  try {
    const body = await req.json();
    address = body?.address;
  } catch {
    address = undefined;
  }

  // Extract client IP (works on Vercel and most proxies)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const tokenConfig = getTokenConfig(tokenId);
  const result = await handleFaucetRequest({
    address,
    ip,
    deps: {
      checkLimit: (clientIp, wallet) =>
        rateLimiter.checkLimit(clientIp, wallet),
      recordMint: (clientIp, wallet, amount) =>
        rateLimiter.recordMint(clientIp, wallet, amount),
      checkTrustline: (wallet) =>
        checkFaucetTrustline(wallet, {
          issuer: tokenConfig.issuer,
          symbol: tokenConfig.symbol,
          horizonUrl: config.horizonUrl,
        }),
      mint: (wallet) =>
        submitMint({
          address: wallet,
          issuerSecret,
          tokenId,
          rpcUrl,
          passphrase,
        }),
    },
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

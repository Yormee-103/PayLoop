import { NextResponse } from "next/server";
import {
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  nativeToScVal,
  StrKey,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import { createRateLimiter } from "@/lib/rate-limiter";

// Server-only faucet: mints test USDC (a Stellar Asset Contract) to a user.
// The SAC admin is the asset issuer; its secret lives in USDC_ISSUER_SECRET and
// is never exposed to the client.

const MINT_AMOUNT = 5_000_000_000n; // 500 USDC at 7 decimals

// Testnet-only guard: the faucet mints a demo asset and must never serve a
// deployment configured against a real-value network (e.g. PUBLIC). The
// passphrase comes from NEXT_PUBLIC_NETWORK_PASSPHRASE, the same config the
// rest of the app runs on.
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
  const horizonUrl =
    process.env.NEXT_PUBLIC_HORIZON_URL ??
    "https://horizon-testnet.stellar.org";
  const passphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? TESTNET_PASSPHRASE;
  const tokenSymbol = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USDC";

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

  let address: string;
  try {
    const body = await req.json();
    address = body?.address;
    if (
      !address ||
      typeof address !== "string" ||
      !StrKey.isValidEd25519PublicKey(address)
    ) {
      return NextResponse.json(
        { error: "A valid Stellar account address (G...) is required." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "A valid Stellar account address (G...) is required." },
      { status: 400 },
    );
  }

  // Extract client IP (works on Vercel and most proxies)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const retryAfterSeconds = await rateLimiter.checkLimit(ip, address);
  if (retryAfterSeconds !== null) {
    return NextResponse.json(
      {
        error: `Faucet already dispensed to this wallet recently. Try again in ${Math.ceil(
          retryAfterSeconds / 60,
        )} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  try {
    const issuer = Keypair.fromSecret(issuerSecret);
    const tokenIssuer =
      process.env.NEXT_PUBLIC_TOKEN_ISSUER ?? issuer.publicKey();

    // Check trustline before building and submitting the transaction
    const horizon = new Horizon.Server(horizonUrl, {
      allowHttp: horizonUrl.startsWith("http://"),
    });

    let hasTrustline = false;
    if (address === issuer.publicKey() || address === tokenIssuer) {
      hasTrustline = true;
    } else {
      try {
        const account = await horizon.loadAccount(address);
        hasTrustline = account.balances.some(
          (b: any) =>
            b.asset_code === tokenSymbol &&
            (b.asset_issuer === tokenIssuer ||
              b.asset_issuer === issuer.publicKey()),
        );
      } catch {
        hasTrustline = false;
      }
    }

    if (!hasTrustline) {
      return NextResponse.json(
        { error: "Recipient account does not have a USDC trustline." },
        { status: 409 },
      );
    }

    const server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith("http://"),
    });
    const source = await server.getAccount(issuer.publicKey());
    const token = new Contract(tokenId);

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(
        token.call(
          "mint",
          new Address(address).toScVal(),
          nativeToScVal(MINT_AMOUNT, { type: "i128" }),
        ),
      )
      .setTimeout(60)
      .build();

    let prepared;
    try {
      prepared = await server.prepareTransaction(tx);
    } catch (prepErr: any) {
      const msg = String(prepErr?.message ?? "");
      if (
        msg.includes("Error(Contract, #13)") ||
        msg.toLowerCase().includes("trustline")
      ) {
        return NextResponse.json(
          { error: "Recipient account does not have a USDC trustline." },
          { status: 409 },
        );
      }
      throw prepErr;
    }

    prepared.sign(issuer);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      return NextResponse.json(
        { error: "Mint transaction was rejected." },
        { status: 502 },
      );
    }

    if (sent.status === "TRY_AGAIN_LATER") {
      return NextResponse.json(
        { error: "Network is busy. Please try again shortly." },
        { status: 503 },
      );
    }

    if (sent.status === "DUPLICATE") {
      return NextResponse.json(
        { error: "A mint transaction for this request is already pending." },
        { status: 409 },
      );
    }

    // Best-effort confirmation.
    let result = await server.getTransaction(sent.hash);
    const started = Date.now();
    while (
      result.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
      Date.now() - started < 20_000
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      result = await server.getTransaction(sent.hash);
    }

    if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      return NextResponse.json(
        { error: "Mint did not confirm in time. Try again shortly." },
        { status: 504 },
      );
    }

    await rateLimiter.recordMint(ip, address, MINT_AMOUNT);
    return NextResponse.json({ ok: true, hash: sent.hash });
  } catch (e: any) {
    console.error("Faucet error:", e);
    return NextResponse.json(
      {
        error:
          "Faucet service encountered an unexpected error. Please try again later.",
      },
      { status: 500 },
    );
  }
}

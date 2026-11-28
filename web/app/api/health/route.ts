import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { checkPayloopHealth, HEALTH_CACHE_CONTROL } from "@/lib/health";

// Uptime probe for Soroban RPC and the invoice contract. It uses only public
// configuration and never reads any server-only secret.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkPayloopHealth({
    rpcUrl: config.rpcUrl,
    contractId: config.contractId,
    readSource: config.readSource,
    networkPassphrase: config.networkPassphrase,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": HEALTH_CACHE_CONTROL },
  });
}

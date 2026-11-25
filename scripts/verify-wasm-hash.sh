#!/usr/bin/env bash
# Compare a locally built invoice WASM with the hash recorded at testnet deployment.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
wasm_path="${1:-$repository_root/contracts/target/wasm32v1-none/release/payloop_invoice.wasm}"
manifest_path="${2:-$repository_root/contracts/deployment.testnet.json}"

if [[ ! -f "$wasm_path" ]]; then
  echo "WASM file not found: $wasm_path" >&2
  echo "Build it first: (cd \"$repository_root/contracts\" && cargo build --target wasm32v1-none --release)" >&2
  exit 2
fi

if [[ ! -f "$manifest_path" ]]; then
  echo "Deployment manifest not found: $manifest_path" >&2
  exit 2
fi

expected_hash="$(sed -nE 's/^[[:space:]]*"wasmHash"[[:space:]]*:[[:space:]]*"([[:xdigit:]]{64})"[,]?$/\1/p' "$manifest_path" | head -n 1)"
if [[ ! "$expected_hash" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "Could not read a 64-character wasmHash from: $manifest_path" >&2
  exit 2
fi

if command -v sha256sum >/dev/null 2>&1; then
  actual_hash="$(sha256sum "$wasm_path" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  actual_hash="$(shasum -a 256 "$wasm_path" | awk '{print $1}')"
else
  echo "Neither sha256sum nor shasum is available; cannot calculate SHA-256." >&2
  exit 2
fi

echo "Built WASM:    $actual_hash"
echo "Deployed WASM: $expected_hash"

if [[ "$actual_hash" != "$expected_hash" ]]; then
  echo "MISMATCH: this build does not match contracts/deployment.testnet.json." >&2
  echo "This source commit is not the source recorded for the deployed testnet contract." >&2
  exit 1
fi

echo "MATCH: this build matches the deployed testnet contract."

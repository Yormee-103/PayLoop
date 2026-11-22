"use client";

import React from "react";
import { validateConfig, type ConfigValidationError } from "@/lib/config";

interface MisconfigurationScreenProps {
  errors?: ConfigValidationError[];
}

export function MisconfigurationScreen({ errors }: MisconfigurationScreenProps) {
  const validationErrors = errors ?? validateConfig();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto my-8 max-w-2xl rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-slate-100 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-xl font-bold text-red-400">
          ⚠️
        </span>
        <div>
          <h1 className="text-xl font-bold text-red-200">
            Configuration Error
          </h1>
          <p className="text-sm text-red-300/80">
            PayLoop could not start because of invalid environment settings.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Detected Problems ({validationErrors.length})
        </h2>
        <ul className="space-y-3 font-mono text-xs">
          {validationErrors.map((err) => (
            <li
              key={err.field}
              className="rounded-lg border border-red-500/20 bg-slate-900/80 p-3.5"
            >
              <div className="flex items-center justify-between font-semibold text-red-400">
                <span>{err.field}</span>
                <span className="text-[10px] text-slate-400 font-sans">
                  received: {JSON.stringify(err.value)}
                </span>
              </div>
              <p className="mt-1 font-sans text-xs text-slate-300">
                {err.message}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">How to fix:</p>
        <p className="mt-1">
          Review your <code>.env.local</code> configuration against <code>.env.example</code>. Ensure all contract IDs, token parameters, and RPC endpoints match valid Stellar testnet or mainnet values.
        </p>
      </div>
    </div>
  );
}

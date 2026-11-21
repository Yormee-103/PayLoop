"use client";

import { useEffect, useState } from "react";

export function PaymentQR({
  url,
  size = 110,
  className = "",
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((QRCode) => {
        QRCode.toDataURL(url, {
          width: size * 2, // 2x resolution for crisp print/mobile rendering
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        })
          .then((result) => {
            if (active) setDataUrl(result);
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-white/10 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] text-slate-400">Loading QR…</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-block rounded-md bg-white p-1.5 shadow-sm ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`Payment QR code for ${url}`}
        width={size}
        height={size}
        className="block"
      />
    </div>
  );
}

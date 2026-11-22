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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);

    import("qrcode")
      .then(async (QRCode) => {
        const result = await QRCode.toDataURL(url, {
          width: size * 2,
          margin: 2,
          errorCorrectionLevel: "M",
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        if (active) setDataUrl(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-md bg-white ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={failed ? "QR code unavailable" : "Loading payment QR code"}
      >
        <span className="text-[10px] text-slate-500">
          {failed ? "QR unavailable" : "Loading QR…"}
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-block rounded-md bg-white p-1.5 shadow-sm ${className}`}>
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

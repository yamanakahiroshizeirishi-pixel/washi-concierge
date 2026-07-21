"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

// 購入ページへ移動する前にクリックを記録する
export function BuyButton({
  productId,
  purchaseUrl,
  logId,
  size = "default",
  className,
}: {
  productId: string;
  purchaseUrl: string | null;
  logId?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  if (!purchaseUrl) {
    return (
      <Button disabled variant="secondary" size={size} className={className}>
        店頭でのお取り扱い
      </Button>
    );
  }
  const handleClick = () => {
    const sessionId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("washi-session-id")
        : null;
    // 記録に失敗しても遷移は妨げない
    fetch("/api/click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, logId: logId ?? null, sessionId }),
      keepalive: true,
    }).catch(() => {});
    window.open(purchaseUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <Button onClick={handleClick} size={size} className={className}>
      購入ページへ
      <ExternalLink aria-hidden className="size-4" />
    </Button>
  );
}

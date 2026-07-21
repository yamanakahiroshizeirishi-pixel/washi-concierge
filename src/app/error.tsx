"use client";

import { Button } from "@/components/ui/button";

// 予期しないエラー時にも画面を止めず、利用者向けの案内を表示する
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-serif text-xl font-semibold">
        申し訳ございません。エラーが発生しました
      </h1>
      <p className="text-sm text-muted-foreground">
        一時的な不具合の可能性があります。少し時間をおいてもう一度お試しください。
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>もう一度試す</Button>
        <Button variant="outline" render={<a href="/" />}>
          トップへ戻る
        </Button>
      </div>
    </main>
  );
}

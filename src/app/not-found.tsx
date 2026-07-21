import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-serif text-xl font-semibold">
        ページが見つかりませんでした
      </h1>
      <p className="text-sm text-muted-foreground">
        お探しの商品・ページは削除されたか、URLが変更された可能性があります。
      </p>
      <Button render={<Link href="/" />}>トップへ戻る</Button>
    </main>
  );
}

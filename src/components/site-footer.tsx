import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground space-y-2">
        <p>
          ※ 本サイトはデモ環境です。掲載されている商品はすべて架空のものであり、
          実在の商品・店舗・メーカーとは関係ありません。
        </p>
        <p className="flex items-center gap-4">
          <span>AI和紙コンシェルジュ</span>
          <Link href="/admin" className="underline underline-offset-4">
            管理画面
          </Link>
        </p>
      </div>
    </footer>
  );
}

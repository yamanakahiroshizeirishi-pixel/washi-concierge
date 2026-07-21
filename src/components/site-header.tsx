import Link from "next/link";
import Image from "next/image";
import { getSettings } from "@/lib/settings";

const NAV = [
  { href: "/chat", label: "AIに相談する" },
  { href: "/diagnosis", label: "かんたん診断" },
  { href: "/products", label: "商品一覧" },
  { href: "/calculator", label: "枚数計算" },
];

export async function SiteHeader() {
  const settings = await getSettings();
  return (
    <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            {settings.logo_url ? (
              // 外部ストレージ画像のため img を使用
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-serif text-lg"
              >
                和
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg font-semibold leading-tight">
                {settings.app_name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {settings.store_name}
              </span>
            </span>
          </Link>
          <nav
            aria-label="メインメニュー"
            className="flex items-center gap-1 overflow-x-auto"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

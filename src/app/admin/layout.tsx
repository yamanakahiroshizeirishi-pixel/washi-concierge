import Link from "next/link";
import { AdminSignOut } from "./sign-out";

export const metadata = { title: "管理画面" };

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/products", label: "商品管理" },
  { href: "/admin/products/csv", label: "CSV登録" },
  { href: "/admin/inventory", label: "在庫管理" },
  { href: "/admin/purchase-orders", label: "発注管理" },
  { href: "/admin/logs", label: "相談履歴" },
  { href: "/admin/analytics", label: "分析" },
  { href: "/admin/settings", label: "設定" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/admin" className="font-serif font-semibold">
            AI和紙コンシェルジュ 管理画面
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              お客様向け画面
            </Link>
            <AdminSignOut />
          </div>
        </div>
        <nav
          aria-label="管理メニュー"
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

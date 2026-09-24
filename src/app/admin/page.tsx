import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [products, published, logs, clicks, unanswered, pendingOrders] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    supabase
      .from("consultation_logs")
      .select("id", { count: "exact", head: true }),
    supabase.from("product_clicks").select("id", { count: "exact", head: true }),
    supabase
      .from("consultation_logs")
      .select("id", { count: "exact", head: true })
      .eq("could_not_answer", true),
    supabase
      .from("purchase_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const lowStock = await supabase
    .from("products")
    .select("id, name, stock_quantity, low_stock_threshold")
    .eq("is_published", true)
    .order("stock_quantity");

  const lowStockItems = (lowStock.data ?? []).filter(
    (p) => p.stock_quantity <= p.low_stock_threshold
  );

  const stats = [
    { label: "登録商品数", value: products.count ?? 0, href: "/admin/products" },
    { label: "公開中の商品", value: published.count ?? 0, href: "/admin/products" },
    { label: "相談件数", value: logs.count ?? 0, href: "/admin/logs" },
    { label: "購入クリック数", value: clicks.count ?? 0, href: "/admin/analytics" },
    {
      label: "回答できなかった相談",
      value: unanswered.count ?? 0,
      href: "/admin/analytics",
    },
    {
      label: "判断待ちの発注明細",
      value: pendingOrders.count ?? 0,
      href: "/admin/purchase-orders",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-semibold">ダッシュボード</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">在庫が少ない商品</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              在庫が少ない商品はありません。
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {lowStockItems.map((p) => (
                <li key={p.id} className="flex justify-between gap-4">
                  <Link
                    href={`/admin/products/${p.id}/edit`}
                    className="underline underline-offset-4"
                  >
                    {p.name}
                  </Link>
                  <span className="text-muted-foreground">
                    残り{p.stock_quantity}点
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

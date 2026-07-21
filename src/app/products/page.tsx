import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import Link from "next/link";

export const metadata = { title: "商品一覧" };

const USAGES = [
  "包装",
  "ギフト",
  "障子",
  "印刷",
  "書道",
  "絵画",
  "工作",
  "インテリア",
  "照明",
  "店舗装飾",
  "名刺",
  "招待状",
  "海外土産",
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ usage?: string; q?: string }>;
}) {
  const { usage, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("*")
    .eq("is_published", true)
    .order("category")
    .order("product_code");
  if (usage && USAGES.includes(usage)) {
    query = query.contains("usage_tags", [usage]);
  }
  if (q) {
    query = query.or(
      `name.ilike.%${q.replaceAll("%", "").replaceAll(",", "")}%,short_description.ilike.%${q.replaceAll("%", "").replaceAll(",", "")}%`
    );
  }
  const { data, error } = await query;
  const products = (data ?? []) as Product[];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="font-serif text-2xl font-semibold">商品一覧</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/products"
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${!usage ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:bg-secondary"}`}
          >
            すべて
          </Link>
          {USAGES.map((u) => (
            <Link
              key={u}
              href={`/products?usage=${encodeURIComponent(u)}`}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${usage === u ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:bg-secondary"}`}
            >
              {u}
            </Link>
          ))}
        </div>

        {error ? (
          <p className="mt-10 text-center text-muted-foreground">
            商品情報の取得に失敗しました。時間をおいて再度お試しください。
          </p>
        ) : products.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">
            条件に合う商品が見つかりませんでした。
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

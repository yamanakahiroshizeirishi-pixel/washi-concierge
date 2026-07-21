import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { BuyButton } from "@/components/buy-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatYen } from "@/lib/settings";
import type { Product } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (!data) notFound();
  const p = data as Product;

  const { data: relatedRows } = await supabase
    .from("related_products")
    .select(
      "relation_type, display_order, related:products!related_products_related_product_id_fkey(id, name, category, tax_included_price, stock_quantity, purchase_url, is_published)"
    )
    .eq("product_id", p.id)
    .order("display_order");

  const related = (relatedRows ?? [])
    .map((r) => ({
      relation_type: r.relation_type,
      rel: r.related as unknown as {
        id: string;
        name: string;
        category: string;
        tax_included_price: number;
        stock_quantity: number;
        is_published: boolean;
      } | null,
    }))
    .filter((r) => r.rel && r.rel.is_published);

  const specs: [string, string | null][] = [
    ["商品コード", p.product_code],
    [
      "サイズ",
      p.width_mm && p.height_mm ? `${p.width_mm} × ${p.height_mm} mm` : null,
    ],
    ["厚さ", p.thickness],
    ["坪量", p.weight_gsm ? `${p.weight_gsm} g/㎡` : null],
    ["原料", p.material],
    ["製法", p.production_method],
    ["産地", p.origin],
    ["製造元", p.manufacturer],
    ["質感", p.texture],
    [
      "強度",
      p.strength_level ? "★".repeat(p.strength_level) + `（${p.strength_level}/5）` : null,
    ],
    [
      "透光性",
      p.transparency_level
        ? "★".repeat(p.transparency_level) + `（${p.transparency_level}/5）`
        : null,
    ],
  ];

  const features: [string, boolean][] = [
    ["インクジェット印刷", p.inkjet_compatible],
    ["レーザープリンター", p.laser_printer_compatible],
    ["書道", p.calligraphy_compatible],
    ["食品への直接接触", p.food_contact_compatible],
    ["耐水", p.water_resistant],
    ["耐熱", p.heat_resistant],
    ["屋外使用", p.outdoor_compatible],
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <nav aria-label="パンくず" className="mb-4 text-sm text-muted-foreground">
          <Link href="/products" className="underline underline-offset-4">
            商品一覧
          </Link>
          <span aria-hidden> / </span>
          <span>{p.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border">
            <ProductImage
              imageUrls={p.image_urls}
              colorTags={p.color_tags}
              category={p.category}
              name={p.name}
            />
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{p.category}</p>
            <h1 className="font-serif text-2xl font-semibold leading-snug">
              {p.name}
            </h1>
            <p className="text-muted-foreground">{p.short_description}</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold">
                {formatYen(p.tax_included_price)}
              </span>
              <span className="text-sm text-muted-foreground">
                税込（税抜 {formatYen(p.price)}）
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge
                stock={p.stock_quantity}
                threshold={p.low_stock_threshold}
              />
              {p.usage_tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <BuyButton productId={p.id} purchaseUrl={p.purchase_url} size="lg" />
              <Link
                href={`/chat?q=${encodeURIComponent(`「${p.name}」について相談したい`)}`}
                className="inline-flex h-10 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-secondary"
              >
                AIに相談する
              </Link>
            </div>
            {p.caution_notes && (
              <p className="rounded-md bg-secondary/70 p-3 text-sm">
                ⚠ {p.caution_notes}
              </p>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-3 font-serif font-semibold">商品説明</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {p.detailed_description}
              </p>
              {p.recommended_uses.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="font-medium">おすすめの使い方: </span>
                  {p.recommended_uses.join("、")}
                </p>
              )}
              {p.prohibited_uses.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium">避けていただきたい用途: </span>
                  {p.prohibited_uses.join("、")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-3 font-serif font-semibold">仕様</h2>
              <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
                {specs
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              <h3 className="mb-2 mt-4 text-sm font-medium">対応表</h3>
              <ul className="grid grid-cols-2 gap-1 text-sm">
                {features.map(([label, ok]) => (
                  <li key={label} className={ok ? "" : "text-muted-foreground"}>
                    {ok ? "○" : "×"} {label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-serif text-lg font-semibold">関連商品</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map(({ relation_type, rel }) => (
                <Link
                  key={rel!.id}
                  href={`/products/${rel!.id}`}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <p className="text-xs text-muted-foreground">
                    {relation_type} ・ {rel!.category}
                  </p>
                  <p className="mt-1 font-medium">{rel!.name}</p>
                  <p className="mt-1 text-sm">
                    {formatYen(rel!.tax_included_price)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      税込
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

"use client";

import Link from "next/link";
import type { RecommendedItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product-image";
import { BuyButton } from "@/components/buy-button";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

// AI提案結果の商品カード（チャット・診断の結果表示に共通で使用）
export function RecommendCard({
  item,
  rank,
  logId,
}: {
  item: RecommendedItem;
  rank: number;
  logId: string | null;
}) {
  const p = item.product;
  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="flex gap-0">
        <div className="w-28 shrink-0 sm:w-36">
          <ProductImage
            imageUrls={p.image_urls}
            colorTags={p.color_tags}
            category={p.category}
            name={p.name}
            className="min-h-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">第{rank}候補</Badge>
              {item.lowStock && (
                <Badge className="bg-accent text-accent-foreground border-transparent">
                  残りわずか（{p.stock_quantity}点）
                </Badge>
              )}
            </div>
            <CardTitle className="font-serif text-base leading-snug">
              {p.name}
            </CardTitle>
            <p className="text-lg font-semibold">
              {yen(p.tax_included_price)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                税込
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
              {p.width_mm && p.height_mm && (
                <>
                  <dt>サイズ</dt>
                  <dd>
                    {p.width_mm} × {p.height_mm} mm
                  </dd>
                </>
              )}
              {p.thickness && (
                <>
                  <dt>厚さ</dt>
                  <dd>{p.thickness}</dd>
                </>
              )}
              {p.origin && (
                <>
                  <dt>産地</dt>
                  <dd>{p.origin}</dd>
                </>
              )}
            </dl>
            {item.score.reasons.length > 0 && (
              <p>
                <span className="font-medium">おすすめ理由: </span>
                {item.score.reasons.join("。")}。
              </p>
            )}
            {item.quantity && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  必要枚数の目安:{" "}
                </span>
                {item.quantity.explanation}
              </p>
            )}
            {item.estimatedTotal && (
              <p>
                <span className="font-medium">概算金額: </span>約
                {yen(item.estimatedTotal)}（税込）
              </p>
            )}
            {p.caution_notes && (
              <p className="rounded-md bg-secondary/70 p-2 text-xs">
                ⚠ {p.caution_notes}
              </p>
            )}
            {item.related.length > 0 && (
              <p className="text-xs text-muted-foreground">
                あわせておすすめ:{" "}
                {item.related.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && "、"}
                    <Link
                      href={`/products/${r.id}`}
                      className="underline underline-offset-2"
                    >
                      {r.name}
                    </Link>
                    （{r.relation_type}）
                  </span>
                ))}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <BuyButton
                productId={p.id}
                purchaseUrl={p.purchase_url}
                logId={logId}
                size="sm"
              />
              <Button
                render={<Link href={`/products/${p.id}`} />}
                variant="outline"
                size="sm"
              >
                詳細を見る
              </Button>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

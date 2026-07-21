import Link from "next/link";
import type { Product } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { formatYen } from "@/lib/settings";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="overflow-hidden py-0 gap-0 transition-shadow hover:shadow-md">
      <Link
        href={`/products/${product.id}`}
        className="block focus-visible:outline-2"
      >
        <div className="aspect-[4/3]">
          <ProductImage
            imageUrls={product.image_urls}
            colorTags={product.color_tags}
            category={product.category}
            name={product.name}
          />
        </div>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs text-muted-foreground">{product.category}</p>
          <h3 className="font-serif font-semibold leading-snug">
            {product.name}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {product.short_description}
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-lg font-semibold">
              {formatYen(product.tax_included_price)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                税込
              </span>
            </span>
            <StockBadge
              stock={product.stock_quantity}
              threshold={product.low_stock_threshold}
            />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

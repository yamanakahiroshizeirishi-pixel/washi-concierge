import { Badge } from "@/components/ui/badge";

export function StockBadge({
  stock,
  threshold,
}: {
  stock: number;
  threshold: number;
}) {
  if (stock <= 0) {
    return <Badge variant="secondary">在庫切れ</Badge>;
  }
  if (stock <= threshold) {
    return (
      <Badge className="bg-accent text-accent-foreground border-transparent">
        残りわずか（{stock}点）
      </Badge>
    );
  }
  return <Badge variant="outline">在庫あり</Badge>;
}

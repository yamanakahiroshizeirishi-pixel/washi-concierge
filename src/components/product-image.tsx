import { cn } from "@/lib/utils";

// 画像未登録の商品用に、色タグに合わせた和紙風プレースホルダーを表示する
const COLOR_CLASS: Record<string, string> = {
  白: "from-stone-100 to-stone-200 text-stone-500",
  生成り: "from-amber-50 to-stone-200 text-stone-500",
  赤系: "from-rose-100 to-rose-200 text-rose-700",
  青系: "from-indigo-100 to-slate-300 text-indigo-800",
  緑系: "from-emerald-100 to-emerald-200 text-emerald-800",
  黄色系: "from-amber-100 to-yellow-200 text-amber-700",
  "金・銀": "from-amber-100 to-stone-300 text-amber-700",
  淡い色: "from-rose-50 to-amber-100 text-rose-400",
  落ち着いた色: "from-stone-200 to-stone-300 text-stone-600",
  鮮やかな色: "from-rose-100 to-amber-200 text-rose-600",
};

export function ProductImage({
  imageUrls,
  colorTags,
  category,
  name,
  className,
}: {
  imageUrls: string[];
  colorTags: string[];
  category: string;
  name: string;
  className?: string;
}) {
  if (imageUrls.length > 0) {
    return (
      // Supabase Storage の外部URLのため img を使用
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrls[0]}
        alt={name}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  const colorClass =
    COLOR_CLASS[colorTags.find((t) => COLOR_CLASS[t]) ?? ""] ??
    "from-stone-100 to-stone-200 text-stone-500";
  return (
    <div
      role="img"
      aria-label={`${name}のイメージ（画像準備中）`}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br",
        colorClass,
        className
      )}
    >
      <span className="font-serif text-3xl">{name.charAt(name.search(/[「]/) >= 0 ? name.search(/[「]/) + 1 : 0)}</span>
      <span className="text-xs">{category}</span>
    </div>
  );
}

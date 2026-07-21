import { z } from "zod";

// 商品登録・編集・CSVインポートの検証スキーマ
const toNum = (allowNull = true) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return allowNull ? null : undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    },
    allowNull ? z.number().nullable() : z.number()
  );

const toBool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string")
    return ["true", "1", "○", "はい", "yes", "TRUE"].includes(v.trim());
  return false;
}, z.boolean());

const toArray = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string")
    return v
      .split(/[,、;／/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}, z.array(z.string()));

export const ProductInputSchema = z.object({
  product_code: z.string().min(1, "商品コードは必須です").max(50),
  name: z.string().min(1, "商品名は必須です").max(200),
  short_description: z.string().max(500).default(""),
  detailed_description: z.string().max(4000).default(""),
  category: z.string().min(1, "カテゴリは必須です").max(50),
  usage_tags: toArray,
  color_tags: toArray,
  pattern_tags: toArray,
  material: z.string().max(200).default(""),
  production_method: z.string().max(200).default(""),
  origin: z.string().max(200).default(""),
  manufacturer: z.string().max(200).default(""),
  width_mm: toNum(),
  height_mm: toNum(),
  thickness: z.string().max(50).default(""),
  weight_gsm: toNum(),
  strength_level: toNum(),
  transparency_level: toNum(),
  texture: z.string().max(200).default(""),
  inkjet_compatible: toBool,
  laser_printer_compatible: toBool,
  calligraphy_compatible: toBool,
  food_contact_compatible: toBool,
  water_resistant: toBool,
  heat_resistant: toBool,
  indoor_compatible: toBool.default(true),
  outdoor_compatible: toBool,
  price: z.preprocess((v) => Number(v), z.number().min(0, "税抜価格は0以上で入力してください")),
  tax_included_price: z.preprocess(
    (v) => Number(v),
    z.number().min(0, "税込価格は0以上で入力してください")
  ),
  stock_quantity: z.preprocess((v) => Number(v), z.number().int().min(0)),
  low_stock_threshold: z.preprocess(
    (v) => (v === "" || v == null ? 5 : Number(v)),
    z.number().int().min(0)
  ),
  minimum_order_quantity: z.preprocess(
    (v) => (v === "" || v == null ? 1 : Number(v)),
    z.number().int().min(1)
  ),
  image_urls: toArray,
  purchase_url: z
    .string()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//.test(v), {
      message: "URLは http(s):// で始めてください",
    })
    .default(""),
  caution_notes: z.string().max(2000).default(""),
  recommended_uses: toArray,
  prohibited_uses: toArray,
  is_published: toBool.default(true),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

// DBへ渡す形へ変換（空文字は null に）
export function toDbRow(input: ProductInput) {
  const nullable = (s: string) => (s === "" ? null : s);
  return {
    ...input,
    short_description: nullable(input.short_description),
    detailed_description: nullable(input.detailed_description),
    material: nullable(input.material),
    production_method: nullable(input.production_method),
    origin: nullable(input.origin),
    manufacturer: nullable(input.manufacturer),
    thickness: nullable(input.thickness),
    texture: nullable(input.texture),
    purchase_url: nullable(input.purchase_url),
    caution_notes: nullable(input.caution_notes),
  };
}

export const CSV_COLUMNS = [
  "product_code",
  "name",
  "short_description",
  "detailed_description",
  "category",
  "usage_tags",
  "color_tags",
  "pattern_tags",
  "material",
  "production_method",
  "origin",
  "manufacturer",
  "width_mm",
  "height_mm",
  "thickness",
  "weight_gsm",
  "strength_level",
  "transparency_level",
  "texture",
  "inkjet_compatible",
  "laser_printer_compatible",
  "calligraphy_compatible",
  "food_contact_compatible",
  "water_resistant",
  "heat_resistant",
  "indoor_compatible",
  "outdoor_compatible",
  "price",
  "tax_included_price",
  "stock_quantity",
  "low_stock_threshold",
  "minimum_order_quantity",
  "image_urls",
  "purchase_url",
  "caution_notes",
  "recommended_uses",
  "prohibited_uses",
  "is_published",
] as const;

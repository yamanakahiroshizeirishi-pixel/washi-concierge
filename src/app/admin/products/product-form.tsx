"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { ProductInputSchema, toDbRow } from "@/lib/product-schema";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// フォームの生値（Zodで検証してからDBへ渡す）
type Raw = {
  product_code: string;
  name: string;
  short_description: string;
  detailed_description: string;
  category: string;
  usage_tags: string;
  color_tags: string;
  pattern_tags: string;
  material: string;
  production_method: string;
  origin: string;
  manufacturer: string;
  width_mm: string;
  height_mm: string;
  thickness: string;
  weight_gsm: string;
  strength_level: string;
  transparency_level: string;
  texture: string;
  inkjet_compatible: boolean;
  laser_printer_compatible: boolean;
  calligraphy_compatible: boolean;
  food_contact_compatible: boolean;
  water_resistant: boolean;
  heat_resistant: boolean;
  indoor_compatible: boolean;
  outdoor_compatible: boolean;
  price: string;
  tax_included_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  minimum_order_quantity: string;
  purchase_url: string;
  caution_notes: string;
  recommended_uses: string;
  prohibited_uses: string;
  is_published: boolean;
};

const CATEGORIES = [
  "包装用和紙",
  "障子紙",
  "印刷用和紙",
  "書道用和紙",
  "絵画用和紙",
  "工作用和紙",
  "インテリア和紙",
  "照明用和紙",
  "ギフト商品",
  "和紙小物",
  "水引",
  "メッセージカード",
  "加工用品",
];

const FLAGS: [keyof Raw, string][] = [
  ["inkjet_compatible", "インクジェット印刷対応"],
  ["laser_printer_compatible", "レーザープリンター対応"],
  ["calligraphy_compatible", "書道対応"],
  ["food_contact_compatible", "食品への直接接触可"],
  ["water_resistant", "耐水"],
  ["heat_resistant", "耐熱"],
  ["indoor_compatible", "屋内使用可"],
  ["outdoor_compatible", "屋外使用可"],
];

function toRaw(p: Product | null): Raw {
  return {
    product_code: p?.product_code ?? "",
    name: p?.name ?? "",
    short_description: p?.short_description ?? "",
    detailed_description: p?.detailed_description ?? "",
    category: p?.category ?? "",
    usage_tags: p?.usage_tags.join(",") ?? "",
    color_tags: p?.color_tags.join(",") ?? "",
    pattern_tags: p?.pattern_tags.join(",") ?? "",
    material: p?.material ?? "",
    production_method: p?.production_method ?? "",
    origin: p?.origin ?? "",
    manufacturer: p?.manufacturer ?? "",
    width_mm: p?.width_mm?.toString() ?? "",
    height_mm: p?.height_mm?.toString() ?? "",
    thickness: p?.thickness ?? "",
    weight_gsm: p?.weight_gsm?.toString() ?? "",
    strength_level: p?.strength_level?.toString() ?? "",
    transparency_level: p?.transparency_level?.toString() ?? "",
    texture: p?.texture ?? "",
    inkjet_compatible: p?.inkjet_compatible ?? false,
    laser_printer_compatible: p?.laser_printer_compatible ?? false,
    calligraphy_compatible: p?.calligraphy_compatible ?? false,
    food_contact_compatible: p?.food_contact_compatible ?? false,
    water_resistant: p?.water_resistant ?? false,
    heat_resistant: p?.heat_resistant ?? false,
    indoor_compatible: p?.indoor_compatible ?? true,
    outdoor_compatible: p?.outdoor_compatible ?? false,
    price: p?.price?.toString() ?? "",
    tax_included_price: p?.tax_included_price?.toString() ?? "",
    stock_quantity: p?.stock_quantity?.toString() ?? "0",
    low_stock_threshold: p?.low_stock_threshold?.toString() ?? "5",
    minimum_order_quantity: p?.minimum_order_quantity?.toString() ?? "1",
    purchase_url: p?.purchase_url ?? "",
    caution_notes: p?.caution_notes ?? "",
    recommended_uses: p?.recommended_uses.join(",") ?? "",
    prohibited_uses: p?.prohibited_uses.join(",") ?? "",
    is_published: p?.is_published ?? true,
  };
}

export function ProductForm({ product }: { product: Product | null }) {
  const router = useRouter();
  const { register, handleSubmit } = useForm<Raw>({
    defaultValues: toRaw(product),
  });
  const [imageUrls, setImageUrls] = useState<string[]>(
    product?.image_urls ?? []
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File) => {
    setUploading(true);
    setErrors([]);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      setImageUrls((prev) => [...prev, data.publicUrl]);
    } catch (e) {
      setErrors([
        `画像のアップロードに失敗しました: ${e instanceof Error ? e.message : ""}`,
      ]);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (raw: Raw) => {
    setSaving(true);
    setErrors([]);
    const parsed = ProductInputSchema.safeParse({
      ...raw,
      image_urls: imageUrls,
    });
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      );
      setSaving(false);
      return;
    }
    const row = toDbRow(parsed.data);
    const supabase = createClient();
    const result = product
      ? await supabase.from("products").update(row).eq("id", product.id)
      : await supabase.from("products").insert(row);
    if (result.error) {
      setErrors([
        result.error.code === "23505"
          ? "商品コードが重複しています。別のコードを指定してください。"
          : `保存に失敗しました: ${result.error.message}`,
      ]);
      setSaving(false);
      return;
    }
    router.push("/admin/products");
    router.refresh();
  };

  const field = (
    name: keyof Raw,
    label: string,
    opts?: { placeholder?: string; required?: boolean }
  ) => (
    <div>
      <Label htmlFor={name}>
        {label}
        {opts?.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={name}
        {...register(name)}
        placeholder={opts?.placeholder}
        className="mt-1 bg-card"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("product_code", "商品コード", { placeholder: "WA-001", required: true })}
          <div>
            <Label htmlFor="category">
              カテゴリ<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="category"
              list="category-list"
              {...register("category")}
              className="mt-1 bg-card"
            />
            <datalist id="category-list">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            {field("name", "商品名", { required: true })}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="short_description">短い説明</Label>
            <Input
              id="short_description"
              {...register("short_description")}
              className="mt-1 bg-card"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="detailed_description">詳しい説明</Label>
            <Textarea
              id="detailed_description"
              rows={4}
              {...register("detailed_description")}
              className="mt-1 bg-card"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_published")} className="size-4" />
            公開する
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            タグ（カンマ区切りで入力）
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {field("usage_tags", "用途タグ", { placeholder: "包装,ギフト" })}
          {field("color_tags", "色タグ", { placeholder: "赤系,落ち着いた色" })}
          {field("pattern_tags", "柄タグ", { placeholder: "無地,金銀入り" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">仕様</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {field("material", "原料", { placeholder: "楮" })}
          {field("production_method", "製法", { placeholder: "手すき" })}
          {field("origin", "産地", { placeholder: "福井県越前市" })}
          {field("manufacturer", "製造元")}
          {field("width_mm", "幅(mm)")}
          {field("height_mm", "高さ(mm)")}
          <div>
            <Label htmlFor="thickness">厚さ</Label>
            <select
              id="thickness"
              {...register("thickness")}
              className="mt-1 h-9 w-full rounded-lg border bg-card px-3 text-sm"
            >
              <option value="">未設定</option>
              <option value="薄口">薄口</option>
              <option value="中厚">中厚</option>
              <option value="厚口">厚口</option>
            </select>
          </div>
          {field("weight_gsm", "坪量(g/㎡)")}
          {field("strength_level", "強度(1-5)")}
          {field("transparency_level", "透光性(1-5)")}
          {field("texture", "質感")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">対応・適性</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FLAGS.map(([name, label]) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register(name)}
                className="size-4"
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">価格・在庫</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {field("price", "税抜価格(円)", { required: true })}
          {field("tax_included_price", "税込価格(円)", { required: true })}
          {field("stock_quantity", "在庫数", { required: true })}
          {field("low_stock_threshold", "残りわずか表示のしきい値")}
          {field("minimum_order_quantity", "最低注文数")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品画像</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {imageUrls.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-24 w-24 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImageUrls((prev) => prev.filter((u) => u !== url))
                  }
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border bg-card text-xs"
                  aria-label="画像を削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <Input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
              e.target.value = "";
            }}
            className="max-w-sm bg-card"
            aria-label="商品画像をアップロード"
          />
          {uploading && (
            <p className="text-sm text-muted-foreground">アップロード中…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">購入・注意事項</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {field("purchase_url", "購入ページURL", {
            placeholder: "https://example.com/shop/WA-001",
          })}
          <div>
            <Label htmlFor="caution_notes">使用上の注意</Label>
            <Textarea
              id="caution_notes"
              rows={3}
              {...register("caution_notes")}
              className="mt-1 bg-card"
            />
          </div>
          {field("recommended_uses", "おすすめ用途（カンマ区切り）")}
          {field("prohibited_uses", "禁止・非推奨用途（カンマ区切り）")}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm">
          <p className="font-medium">入力内容を確認してください:</p>
          <ul className="mt-1 list-inside list-disc">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "保存中…" : product ? "更新する" : "登録する"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/admin/products")}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}

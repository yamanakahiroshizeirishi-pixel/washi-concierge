"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { InventoryItemInputSchema, toItemDbRow } from "@/lib/inventory-schema";
import type { InventoryItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Raw = {
  sku: string;
  name: string;
  supplier_name: string;
  purchase_price: string;
  wholesale_price: string;
  low_stock_threshold: string;
  is_active: boolean;
  note: string;
};

function toRaw(item: InventoryItem | null): Raw {
  return {
    sku: item?.sku ?? "",
    name: item?.name ?? "",
    supplier_name: item?.supplier_name ?? "",
    purchase_price: item?.purchase_price?.toString() ?? "0",
    wholesale_price: item?.wholesale_price?.toString() ?? "",
    low_stock_threshold: item?.low_stock_threshold?.toString() ?? "0",
    is_active: item?.is_active ?? true,
    note: item?.note ?? "",
  };
}

export function ItemForm({ item }: { item: InventoryItem | null }) {
  const router = useRouter();
  const { register, handleSubmit } = useForm<Raw>({ defaultValues: toRaw(item) });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (raw: Raw) => {
    setSaving(true);
    setErrors([]);
    const parsed = InventoryItemInputSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      setSaving(false);
      return;
    }
    const row = toItemDbRow(parsed.data);
    const supabase = createClient();
    const result = item
      ? await supabase.from("inventory_items").update(row).eq("id", item.id)
      : await supabase.from("inventory_items").insert(row);
    if (result.error) {
      setErrors([
        result.error.code === "23505"
          ? "SKUが重複しています。別のSKUを指定してください。"
          : `保存に失敗しました: ${result.error.message}`,
      ]);
      setSaving(false);
      return;
    }
    router.push("/admin/inventory");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">
              商品名<span className="text-destructive"> *</span>
            </Label>
            <Input id="name" {...register("name")} className="mt-1 bg-card" />
          </div>
          <div>
            <Label htmlFor="sku">SKU（任意）</Label>
            <Input id="sku" {...register("sku")} className="mt-1 bg-card" />
          </div>
          <div>
            <Label htmlFor="supplier_name">仕入先</Label>
            <Input id="supplier_name" {...register("supplier_name")} className="mt-1 bg-card" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_active")} className="size-4" />
            アクティブ（発注書の取り込みで候補にする）
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">価格・在庫しきい値</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="purchase_price">
              仕入価格（税抜・円）<span className="text-destructive"> *</span>
            </Label>
            <Input id="purchase_price" {...register("purchase_price")} className="mt-1 bg-card" />
          </div>
          <div>
            <Label htmlFor="wholesale_price">卸価格の目安（円）</Label>
            <Input id="wholesale_price" {...register("wholesale_price")} className="mt-1 bg-card" />
          </div>
          <div>
            <Label htmlFor="low_stock_threshold">残りわずかのしきい値</Label>
            <Input
              id="low_stock_threshold"
              {...register("low_stock_threshold")}
              className="mt-1 bg-card"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">メモ</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea id="note" rows={3} {...register("note")} className="bg-card" />
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
          {saving ? "保存中…" : item ? "更新する" : "登録する"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/admin/inventory")}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}

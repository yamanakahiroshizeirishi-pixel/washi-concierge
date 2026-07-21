"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

const RELATION_TYPES = [
  "水引",
  "包装用品",
  "接着剤",
  "メッセージカード",
  "額縁",
  "加工用品",
  "類似商品",
  "上位商品",
  "代替商品",
];

type Row = {
  id: string;
  relation_type: string;
  display_order: number;
  related: { id: string; name: string } | null;
};

export function RelatedEditor({ productId }: { productId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>(
    []
  );
  const [selected, setSelected] = useState("");
  const [relationType, setRelationType] = useState(RELATION_TYPES[0]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: rels }, { data: prods }] = await Promise.all([
      supabase
        .from("related_products")
        .select(
          "id, relation_type, display_order, related:products!related_products_related_product_id_fkey(id, name)"
        )
        .eq("product_id", productId)
        .order("display_order"),
      supabase
        .from("products")
        .select("id, name")
        .neq("id", productId)
        .order("product_code"),
    ]);
    setRows((rels ?? []) as unknown as Row[]);
    setCandidates(prods ?? []);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!selected) return;
    const supabase = createClient();
    const { error } = await supabase.from("related_products").insert({
      product_id: productId,
      related_product_id: selected,
      relation_type: relationType,
      display_order: rows.length + 1,
    });
    setMessage(
      error
        ? error.code === "23505"
          ? "この商品はすでに関連商品として登録されています。"
          : `登録に失敗しました: ${error.message}`
        : null
    );
    load();
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    await supabase.from("related_products").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">関連商品</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            関連商品は登録されていません。
          </p>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <span>
                  <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {r.relation_type}
                  </span>
                  {r.related?.name ?? "(削除済み商品)"}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(r.id)}
                  aria-label="関連商品を解除"
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="rel-product" className="text-sm">
              商品
            </label>
            <select
              id="rel-product"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 block h-9 w-64 rounded-lg border bg-card px-3 text-sm"
            >
              <option value="">選択してください</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rel-type" className="text-sm">
              関連の種類
            </label>
            <select
              id="rel-type"
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="mt-1 block h-9 rounded-lg border bg-card px-3 text-sm"
            >
              {RELATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={add} disabled={!selected}>
            追加
          </Button>
        </div>
        {message && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}

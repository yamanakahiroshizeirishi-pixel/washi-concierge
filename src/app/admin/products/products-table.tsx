"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

export function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("product_code");
    if (error) setMessage(`読み込みに失敗しました: ${error.message}`);
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = async (
    id: string,
    fields: Partial<Pick<Product, "is_published" | "stock_quantity">>
  ) => {
    const supabase = createClient();
    const { error } = await supabase.from("products").update(fields).eq("id", id);
    if (error) {
      setMessage(`更新に失敗しました: ${error.message}`);
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...fields } : p))
    );
  };

  const duplicate = async (p: Product) => {
    const supabase = createClient();
    const copy: Record<string, unknown> = { ...p };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    copy.product_code = `${p.product_code}-C${Date.now().toString().slice(-5)}`;
    copy.name = `${p.name}（複製）`;
    copy.is_published = false;
    const { error } = await supabase.from("products").insert(copy);
    if (error) {
      setMessage(`複製に失敗しました: ${error.message}`);
      return;
    }
    setMessage(`「${p.name}」を複製しました（非公開の状態です）`);
    load();
  };

  const remove = async (p: Product) => {
    if (
      !window.confirm(
        `「${p.name}」を削除します。よろしいですか？\nこの操作は元に戻せません。`
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      setMessage(`削除に失敗しました: ${error.message}`);
      return;
    }
    setMessage(`「${p.name}」を削除しました`);
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
  };

  const filtered = products.filter(
    (p) =>
      !filter ||
      p.name.includes(filter) ||
      p.product_code.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.includes(filter)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">商品管理</h1>
        <Button render={<Link href="/admin/products/new" />}>
          <Plus aria-hidden className="size-4" />
          新規登録
        </Button>
      </div>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="商品名・商品コード・カテゴリで絞り込み"
        className="max-w-sm bg-card"
        aria-label="商品の絞り込み"
      />

      {message && (
        <p className="rounded-md bg-secondary p-2 text-sm">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead>カテゴリ</TableHead>
                <TableHead className="text-right">税込価格</TableHead>
                <TableHead className="text-right">在庫</TableHead>
                <TableHead>公開</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.product_code}
                  </TableCell>
                  <TableCell className="max-w-60">
                    <span className="line-clamp-2">{p.name}</span>
                  </TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="text-right">
                    {p.tax_included_price.toLocaleString()}円
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={p.stock_quantity}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n >= 0 && n !== p.stock_quantity)
                          updateField(p.id, { stock_quantity: n });
                      }}
                      className="ml-auto h-8 w-20 text-right"
                      aria-label={`${p.name}の在庫数`}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.is_published}
                      onCheckedChange={(checked: boolean) =>
                        updateField(p.id, { is_published: checked })
                      }
                      aria-label={`${p.name}を公開する`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/admin/products/${p.id}/edit`} />}
                        aria-label={`${p.name}を編集`}
                      >
                        <Pencil aria-hidden className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => duplicate(p)}
                        aria-label={`${p.name}を複製`}
                      >
                        <Copy aria-hidden className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(p)}
                        aria-label={`${p.name}を削除`}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

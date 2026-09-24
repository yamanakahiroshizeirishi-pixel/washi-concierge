"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { currentStock } from "@/lib/inventory";
import type { InventoryItem, InventoryMovement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListTree, Pencil, Plus, Trash2 } from "lucide-react";

export function InventoryListClient() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [itemsRes, movementsRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name"),
      supabase
        .from("inventory_movements")
        .select("id, item_id, channel_id, movement_type, quantity, occurred_on, note, purchase_order_line_id, created_at"),
    ]);
    if (itemsRes.error) setMessage(`読み込みに失敗しました: ${itemsRes.error.message}`);
    setItems((itemsRes.data ?? []) as InventoryItem[]);
    setMovements((movementsRes.data ?? []) as InventoryMovement[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (item: InventoryItem) => {
    if (
      !window.confirm(
        `「${item.name}」を削除します。入出庫履歴もすべて削除されます。よろしいですか？`
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (error) {
      setMessage(`削除に失敗しました: ${error.message}`);
      return;
    }
    setMessage(`「${item.name}」を削除しました`);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  };

  const filtered = items.filter(
    (i) =>
      !filter ||
      i.name.includes(filter) ||
      (i.sku ?? "").toLowerCase().includes(filter.toLowerCase()) ||
      (i.supplier_name ?? "").includes(filter)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">在庫管理</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/inventory/channels" />}>
            <ListTree aria-hidden className="size-4" />
            出荷先チャンネル管理
          </Button>
          <Button render={<Link href="/admin/inventory/new" />}>
            <Plus aria-hidden className="size-4" />
            品目を登録
          </Button>
        </div>
      </div>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="商品名・SKU・仕入先で絞り込み"
        className="max-w-sm bg-card"
        aria-label="在庫品目の絞り込み"
      />

      {message && <p className="rounded-md bg-secondary p-2 text-sm">{message}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>仕入先</TableHead>
                <TableHead className="text-right">仕入価格</TableHead>
                <TableHead className="text-right">現在庫</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const stock = currentStock(
                  movements.filter((m) => m.item_id === item.id)
                );
                const low = stock <= item.low_stock_threshold;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-60">
                      <Link
                        href={`/admin/inventory/${item.id}`}
                        className="line-clamp-2 underline underline-offset-4"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.sku ?? "—"}</TableCell>
                    <TableCell>{item.supplier_name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {item.purchase_price.toLocaleString()}円
                    </TableCell>
                    <TableCell className="text-right font-medium">{stock}</TableCell>
                    <TableCell>
                      {!item.is_active ? (
                        <Badge variant="secondary">非アクティブ</Badge>
                      ) : stock <= 0 ? (
                        <Badge variant="destructive">在庫切れ</Badge>
                      ) : low ? (
                        <Badge className="bg-accent text-accent-foreground border-transparent">
                          残りわずか
                        </Badge>
                      ) : (
                        <Badge variant="outline">在庫あり</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={<Link href={`/admin/inventory/${item.id}/edit`} />}
                          aria-label={`${item.name}を編集`}
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(item)}
                          aria-label={`${item.name}を削除`}
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    品目が登録されていません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

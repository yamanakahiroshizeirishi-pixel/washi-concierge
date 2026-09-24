"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { currentStock, nextMonthStartISO } from "@/lib/inventory";
import type {
  InventoryChannel,
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  PurchaseOrderLine,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, PackageCheck } from "lucide-react";

export function BackordersClient() {
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [channels, setChannels] = useState<InventoryChannel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [shipQty, setShipQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [linesRes, ordersRes, channelsRes, itemsRes] = await Promise.all([
      supabase
        .from("purchase_order_lines")
        .select("*")
        .gt("carried_over_qty", 0)
        .in("status", ["carried_over", "partial"])
        .order("target_month"),
      supabase.from("purchase_orders").select("*"),
      supabase.from("inventory_channels").select("*"),
      supabase.from("inventory_items").select("*"),
    ]);
    const lineRows = (linesRes.data ?? []) as PurchaseOrderLine[];
    setLines(lineRows);
    setOrders((ordersRes.data ?? []) as PurchaseOrder[]);
    setChannels((channelsRes.data ?? []) as InventoryChannel[]);
    setItems((itemsRes.data ?? []) as InventoryItem[]);

    const itemIds = Array.from(new Set(lineRows.map((l) => l.item_id).filter((v): v is string => !!v)));
    if (itemIds.length > 0) {
      const { data: movementRows } = await supabase
        .from("inventory_movements")
        .select("*")
        .in("item_id", itemIds);
      const grouped = (movementRows ?? []).reduce<Record<string, InventoryMovement[]>>((acc, m) => {
        (acc[m.item_id] ??= []).push(m as InventoryMovement);
        return acc;
      }, {});
      const map: Record<string, number> = {};
      for (const id of itemIds) map[id] = currentStock(grouped[id] ?? []);
      setStockMap(map);
      setShipQty((prev) => {
        const next = { ...prev };
        for (const line of lineRows) {
          if (line.item_id && next[line.id] === undefined) {
            next[line.id] = Math.min(line.carried_over_qty, map[line.item_id] ?? 0);
          }
        }
        return next;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const channelName = (id: string | null) =>
    id ? channels.find((c) => c.id === id)?.name ?? "（削除済み）" : "—";
  const itemName = (id: string | null) =>
    id ? items.find((i) => i.id === id)?.name ?? "（削除済み品目）" : "—";

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const shipSelected = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    const supabase = createClient();
    const failures: string[] = [];

    for (const id of selectedIds) {
      const line = lines.find((l) => l.id === id);
      if (!line || !line.item_id) continue;
      const order = orderById.get(line.purchase_order_id);
      const qty = Math.max(0, Math.min(shipQty[id] ?? 0, line.carried_over_qty));
      if (qty <= 0) continue;

      const { data: movement, error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          item_id: line.item_id,
          channel_id: order?.channel_id ?? null,
          movement_type: "shipment",
          quantity: qty,
          occurred_on: new Date().toISOString().slice(0, 10),
          note: "繰り越し分のまとめ出荷",
          purchase_order_line_id: line.id,
        })
        .select()
        .single();
      if (movementError || !movement) {
        failures.push(`${itemName(line.item_id)}: ${movementError?.message ?? "出荷登録に失敗しました"}`);
        continue;
      }

      const remaining = line.carried_over_qty - qty;
      const { error: updError } = await supabase
        .from("purchase_order_lines")
        .update({
          fulfilled_qty: line.fulfilled_qty + qty,
          carried_over_qty: remaining,
          status: remaining > 0 ? "partial" : "fulfilled",
          target_month: remaining > 0 ? nextMonthStartISO(new Date().toISOString().slice(0, 10)) : null,
          decided_at: new Date().toISOString(),
          decision_note:
            remaining > 0
              ? "繰越分を一部まとめて出荷（残りはさらに来月へ）"
              : "繰越分をまとめて出荷し完了",
          shipment_movement_id: movement.id,
        })
        .eq("id", line.id);
      if (updError) failures.push(`${itemName(line.item_id)}: ${updError.message}`);
    }

    setSubmitting(false);
    setSelected({});
    setMessage(failures.length > 0 ? `一部失敗しました:\n${failures.join("\n")}` : `${selectedIds.length}件をまとめて出荷しました`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">来月繰り越し一覧</h1>
          <p className="text-sm text-muted-foreground">
            在庫不足で今回は出荷せず来月にまわすと判断した発注明細です。
            入荷して出荷できるようになったものを選び、まとめて出荷登録できます。
          </p>
        </div>
        <Button variant="outline" render={<Link href="/admin/purchase-orders" />}>
          <ArrowLeft aria-hidden className="size-4" />
          発注管理へ戻る
        </Button>
      </div>

      {message && (
        <p className="whitespace-pre-line rounded-md bg-secondary p-2 text-sm">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>商品名</TableHead>
                  <TableHead>元の発注元</TableHead>
                  <TableHead className="text-right">繰越数</TableHead>
                  <TableHead className="text-right">現在庫</TableHead>
                  <TableHead className="w-28">出荷数量</TableHead>
                  <TableHead>対象月</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const order = orderById.get(line.purchase_order_id);
                  const available = line.item_id ? stockMap[line.item_id] ?? 0 : 0;
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[line.id]}
                          onCheckedChange={(checked: boolean) =>
                            setSelected((prev) => ({ ...prev, [line.id]: checked }))
                          }
                          aria-label="この明細を選択"
                        />
                      </TableCell>
                      <TableCell>{itemName(line.item_id)}</TableCell>
                      <TableCell>{channelName(order?.channel_id ?? null)}</TableCell>
                      <TableCell className="text-right font-medium">{line.carried_over_qty}</TableCell>
                      <TableCell className="text-right">
                        {available}
                        {available <= 0 && (
                          <Badge variant="destructive" className="ml-2">
                            在庫切れ
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={line.carried_over_qty}
                          value={shipQty[line.id] ?? 0}
                          onChange={(e) =>
                            setShipQty((prev) => ({
                              ...prev,
                              [line.id]: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="w-24 bg-card"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {line.target_month?.slice(0, 7) ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      来月に繰り越された発注明細はありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Button disabled={selectedIds.length === 0 || submitting} onClick={shipSelected}>
            <PackageCheck aria-hidden className="size-4" />
            {submitting ? "処理中…" : `選択した${selectedIds.length}件をまとめて出荷`}
          </Button>
        </>
      )}
    </div>
  );
}

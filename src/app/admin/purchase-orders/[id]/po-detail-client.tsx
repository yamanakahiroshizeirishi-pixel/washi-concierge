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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const STATUS_LABEL: Record<PurchaseOrderLine["status"], { label: string; variant: "outline" | "secondary" | "destructive" | "default" }> = {
  pending: { label: "要判断", variant: "destructive" },
  fulfilled: { label: "出荷済み", variant: "outline" },
  partial: { label: "一部出荷・残り繰越", variant: "secondary" },
  carried_over: { label: "来月へ繰越", variant: "secondary" },
};

export function PoDetailClient({ order }: { order: PurchaseOrder }) {
  const [channels, setChannels] = useState<InventoryChannel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [channelsRes, itemsRes, linesRes] = await Promise.all([
      supabase.from("inventory_channels").select("*"),
      supabase.from("inventory_items").select("*").order("name"),
      supabase
        .from("purchase_order_lines")
        .select("*")
        .eq("purchase_order_id", order.id)
        .order("created_at"),
    ]);
    setChannels((channelsRes.data ?? []) as InventoryChannel[]);
    setItems((itemsRes.data ?? []) as InventoryItem[]);
    const lineRows = (linesRes.data ?? []) as PurchaseOrderLine[];
    setLines(lineRows);

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
    } else {
      setStockMap({});
    }
    setLoading(false);
  }, [order.id]);

  useEffect(() => {
    load();
  }, [load]);

  const channelName = channels.find((c) => c.id === order.channel_id)?.name ?? "—";
  const itemName = (id: string | null) => (id ? items.find((i) => i.id === id)?.name ?? "（削除済み品目）" : null);

  const assignItem = async (line: PurchaseOrderLine) => {
    const itemId = assignSelection[line.id];
    if (!itemId) return;
    setBusyLineId(line.id);
    const supabase = createClient();
    const { error: updError } = await supabase
      .from("purchase_order_lines")
      .update({ item_id: itemId })
      .eq("id", line.id);
    setBusyLineId(null);
    if (updError) {
      setError(`ひも付けに失敗しました: ${updError.message}`);
      return;
    }
    await load();
  };

  const decide = async (
    line: PurchaseOrderLine,
    mode: "ship_all" | "ship_available" | "carry_all"
  ) => {
    if (!line.item_id) return;
    const available = stockMap[line.item_id] ?? 0;
    let shipQty = 0;
    if (mode === "ship_all") {
      shipQty = line.ordered_qty;
      if (shipQty > available) {
        const ok = window.confirm(
          `現在庫（${available}）を超える数量（${shipQty}）を出荷します。よろしいですか？`
        );
        if (!ok) return;
      }
    } else if (mode === "ship_available") {
      shipQty = Math.min(available, line.ordered_qty);
    }
    const carryQty = line.ordered_qty - shipQty;

    setBusyLineId(line.id);
    setError(null);
    const supabase = createClient();
    let movementId: string | null = null;

    if (shipQty > 0) {
      const { data: movement, error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          item_id: line.item_id,
          channel_id: order.channel_id,
          movement_type: "shipment",
          quantity: shipQty,
          occurred_on: new Date().toISOString().slice(0, 10),
          note: `発注書${order.order_no ? `（${order.order_no}）` : ""}への対応出荷`,
          purchase_order_line_id: line.id,
        })
        .select()
        .single();
      if (movementError || !movement) {
        setError(`出荷登録に失敗しました: ${movementError?.message ?? ""}`);
        setBusyLineId(null);
        return;
      }
      movementId = movement.id;
    }

    const status: PurchaseOrderLine["status"] =
      carryQty > 0 ? (shipQty > 0 ? "partial" : "carried_over") : "fulfilled";
    const decisionNote =
      mode === "ship_all"
        ? "全量出荷"
        : mode === "ship_available"
          ? "在庫分のみ出荷し、残りを来月にまわす判断"
          : "在庫なしのため今回は出荷せず、来月にまわす判断";

    const { error: updError } = await supabase
      .from("purchase_order_lines")
      .update({
        fulfilled_qty: line.fulfilled_qty + shipQty,
        carried_over_qty: carryQty,
        status,
        target_month: carryQty > 0 ? nextMonthStartISO(order.order_date) : null,
        decided_at: new Date().toISOString(),
        decision_note: decisionNote,
        shipment_movement_id: movementId,
      })
      .eq("id", line.id);

    setBusyLineId(null);
    if (updError) {
      setError(`判断の保存に失敗しました: ${updError.message}`);
      return;
    }
    await load();
  };

  const pendingCount = useMemo(() => lines.filter((l) => l.status === "pending").length, [lines]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">
            発注書詳細{order.order_no ? `（${order.order_no}）` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            発注元: {channelName} ／ 発注日: {order.order_date}
            {order.source_filename && ` ／ 取り込みファイル: ${order.source_filename}`}
          </p>
        </div>
        <Button variant="outline" render={<Link href="/admin/purchase-orders" />}>
          <ArrowLeft aria-hidden className="size-4" />
          発注管理へ戻る
        </Button>
      </div>

      {pendingCount > 0 && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm">
          在庫不足などで判断が必要な明細が {pendingCount} 件あります。
        </p>
      )}
      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => {
            const name = itemName(line.item_id) ?? line.raw_item_name;
            const available = line.item_id ? stockMap[line.item_id] ?? 0 : null;
            const status = STATUS_LABEL[line.status];
            return (
              <Card key={line.id}>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-base">{name}</CardTitle>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>発注数: <span className="font-medium">{line.ordered_qty}</span></span>
                    {available !== null && (
                      <span>
                        現在庫: <span className="font-medium">{available}</span>
                      </span>
                    )}
                    <span>出荷済み: {line.fulfilled_qty}</span>
                    {line.carried_over_qty > 0 && (
                      <span>
                        来月繰越: <span className="font-medium">{line.carried_over_qty}</span>
                        {line.target_month && `（対象: ${line.target_month.slice(0, 7)}）`}
                      </span>
                    )}
                  </div>
                  {line.decision_note && (
                    <p className="text-xs text-muted-foreground">判断: {line.decision_note}</p>
                  )}

                  {!line.item_id && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={assignSelection[line.id] ?? ""}
                        onChange={(e) =>
                          setAssignSelection((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                        className="h-9 min-w-48 rounded-lg border bg-card px-3 text-sm"
                      >
                        <option value="">在庫品目を選択</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyLineId === line.id || !assignSelection[line.id]}
                        onClick={() => assignItem(line)}
                      >
                        この品目にひも付ける
                      </Button>
                    </div>
                  )}

                  {line.item_id && line.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busyLineId === line.id}
                        onClick={() => decide(line, "ship_all")}
                      >
                        全量出荷する（{line.ordered_qty}）
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          busyLineId === line.id ||
                          (available ?? 0) <= 0 ||
                          (available ?? 0) >= line.ordered_qty
                        }
                        onClick={() => decide(line, "ship_available")}
                      >
                        在庫分（{available ?? 0}）だけ出荷し、残りを来月にまわす
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyLineId === line.id}
                        onClick={() => decide(line, "carry_all")}
                      >
                        出荷せず、全量を来月にまわす
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {lines.length === 0 && (
            <p className="text-sm text-muted-foreground">明細がありません</p>
          )}
        </div>
      )}
    </div>
  );
}

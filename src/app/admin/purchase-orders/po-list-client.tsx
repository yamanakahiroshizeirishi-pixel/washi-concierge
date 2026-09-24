"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InventoryChannel, PurchaseOrder, PurchaseOrderLine } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Upload } from "lucide-react";

export function PoListClient() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [channels, setChannels] = useState<InventoryChannel[]>([]);
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [ordersRes, channelsRes, linesRes] = await Promise.all([
      supabase.from("purchase_orders").select("*").order("order_date", { ascending: false }),
      supabase.from("inventory_channels").select("*"),
      supabase.from("purchase_order_lines").select("*"),
    ]);
    if (ordersRes.error) setMessage(`読み込みに失敗しました: ${ordersRes.error.message}`);
    setOrders((ordersRes.data ?? []) as PurchaseOrder[]);
    setChannels((channelsRes.data ?? []) as InventoryChannel[]);
    setLines((linesRes.data ?? []) as PurchaseOrderLine[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const channelName = (id: string | null) =>
    id ? channels.find((c) => c.id === id)?.name ?? "（削除済み）" : "—";

  const backorderCount = lines.filter(
    (l) => l.status === "carried_over" || (l.status === "partial" && l.carried_over_qty > 0)
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">発注管理</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/purchase-orders/backorders" />}>
            <Clock aria-hidden className="size-4" />
            来月繰り越し一覧
            {backorderCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {backorderCount}
              </Badge>
            )}
          </Button>
          <Button render={<Link href="/admin/purchase-orders/upload" />}>
            <Upload aria-hidden className="size-4" />
            発注書を取り込む
          </Button>
        </div>
      </div>

      {message && <p className="rounded-md bg-destructive/10 p-2 text-sm">{message}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>発注日</TableHead>
                <TableHead>発注番号</TableHead>
                <TableHead>発注元</TableHead>
                <TableHead className="text-right">明細数</TableHead>
                <TableHead className="text-right">要判断</TableHead>
                <TableHead>状態</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const orderLines = lines.filter((l) => l.purchase_order_id === o.id);
                const pendingCount = orderLines.filter((l) => l.status === "pending").length;
                return (
                  <TableRow key={o.id}>
                    <TableCell>{o.order_date}</TableCell>
                    <TableCell>{o.order_no || "—"}</TableCell>
                    <TableCell>{channelName(o.channel_id)}</TableCell>
                    <TableCell className="text-right">{orderLines.length}</TableCell>
                    <TableCell className="text-right">
                      {pendingCount > 0 ? (
                        <Badge variant="destructive">{pendingCount}件</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {o.status === "draft" && <Badge variant="secondary">下書き</Badge>}
                      {o.status === "confirmed" && <Badge variant="outline">確定</Badge>}
                      {o.status === "closed" && <Badge>完了</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/purchase-orders/${o.id}`} />}
                      >
                        詳細
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    発注書がまだ取り込まれていません
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

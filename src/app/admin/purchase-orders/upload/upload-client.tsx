"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { currentStock, matchItemByName, parseOrderFileRows } from "@/lib/inventory";
import type { InventoryChannel, InventoryItem, InventoryMovement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileUp, Trash2 } from "lucide-react";

type PreviewRow = {
  key: string;
  item_name: string;
  quantity: number;
  note: string;
  matchedItemId: string;
};

export function UploadClient() {
  const router = useRouter();
  const [channels, setChannels] = useState<InventoryChannel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [channelId, setChannelId] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [channelsRes, itemsRes] = await Promise.all([
      supabase.from("inventory_channels").select("*").order("display_order").order("name"),
      supabase.from("inventory_items").select("*").eq("is_active", true).order("name"),
    ]);
    setChannels((channelsRes.data ?? []) as InventoryChannel[]);
    setItems((itemsRes.data ?? []) as InventoryItem[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buildPreview = (parsedRows: Record<string, unknown>[]) => {
    const orderRows = parseOrderFileRows(parsedRows);
    if (orderRows.length === 0) {
      setParseError(
        "商品名・数量の列を読み取れませんでした。ヘッダーに「商品名」「数量」（またはそれに近い列名）が含まれているか確認してください。"
      );
      setRows([]);
      return;
    }
    setParseError(null);
    setRows(
      orderRows.map((r, i) => ({
        key: `${Date.now()}-${i}`,
        item_name: r.item_name,
        quantity: r.quantity,
        note: r.note,
        matchedItemId: matchItemByName(r.item_name, items)?.id ?? "",
      }))
    );
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => buildPreview(result.data),
        error: (err) => setParseError(`CSVの読み込みに失敗しました: ${err.message}`),
      });
    } else {
      file
        .arrayBuffer()
        .then((buf) => {
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: "",
          });
          buildPreview(parsedRows);
        })
        .catch((err) =>
          setParseError(`Excelファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : ""}`)
        );
    }
  };

  const updateRow = (key: string, patch: Partial<PreviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));
  const addBlankRow = () =>
    setRows((prev) => [
      ...prev,
      { key: `manual-${Date.now()}`, item_name: "", quantity: 1, note: "", matchedItemId: "" },
    ]);

  const confirm = async () => {
    setSubmitError(null);
    if (!channelId) {
      setSubmitError("発注元チャンネルを選択してください");
      return;
    }
    const validRows = rows.filter((r) => r.item_name.trim() !== "" && r.quantity > 0);
    if (validRows.length === 0) {
      setSubmitError("取り込む明細がありません");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        order_no: orderNo || null,
        channel_id: channelId,
        order_date: orderDate,
        status: "confirmed",
        source_filename: fileName,
        note: note || null,
      })
      .select()
      .single();
    if (orderError || !order) {
      setSubmitError(`発注書の作成に失敗しました: ${orderError?.message ?? ""}`);
      setSubmitting(false);
      return;
    }

    const matchedItemIds = Array.from(
      new Set(validRows.map((r) => r.matchedItemId).filter(Boolean))
    );
    let movementsByItem: Record<string, InventoryMovement[]> = {};
    if (matchedItemIds.length > 0) {
      const { data: movementRows } = await supabase
        .from("inventory_movements")
        .select("*")
        .in("item_id", matchedItemIds);
      movementsByItem = (movementRows ?? []).reduce<Record<string, InventoryMovement[]>>(
        (acc, m) => {
          (acc[m.item_id] ??= []).push(m as InventoryMovement);
          return acc;
        },
        {}
      );
    }
    const availableStock: Record<string, number> = {};
    for (const id of matchedItemIds) {
      availableStock[id] = currentStock(movementsByItem[id] ?? []);
    }

    const failures: string[] = [];
    for (const r of validRows) {
      const itemId = r.matchedItemId || null;
      const { data: line, error: lineError } = await supabase
        .from("purchase_order_lines")
        .insert({
          purchase_order_id: order.id,
          item_id: itemId,
          raw_item_name: r.item_name,
          ordered_qty: r.quantity,
        })
        .select()
        .single();
      if (lineError || !line) {
        failures.push(`${r.item_name}: ${lineError?.message ?? "登録に失敗しました"}`);
        continue;
      }

      if (itemId && (availableStock[itemId] ?? 0) >= r.quantity) {
        const { data: movement, error: movementError } = await supabase
          .from("inventory_movements")
          .insert({
            item_id: itemId,
            channel_id: channelId,
            movement_type: "shipment",
            quantity: r.quantity,
            occurred_on: orderDate,
            note: `発注書取り込み${order.order_no ? `（${order.order_no}）` : ""}`,
            purchase_order_line_id: line.id,
          })
          .select()
          .single();
        if (!movementError && movement) {
          availableStock[itemId] -= r.quantity;
          await supabase
            .from("purchase_order_lines")
            .update({
              fulfilled_qty: r.quantity,
              status: "fulfilled",
              decided_at: new Date().toISOString(),
              decision_note: "在庫あり・自動出荷",
              shipment_movement_id: movement.id,
            })
            .eq("id", line.id);
        }
      }
    }

    setSubmitting(false);
    if (failures.length > 0) {
      setSubmitError(`一部の明細を登録できませんでした:\n${failures.join("\n")}`);
    }
    router.push(`/admin/purchase-orders/${order.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">発注書の取り込み</h1>
        <Button variant="outline" render={<Link href="/admin/purchase-orders" />}>
          <ArrowLeft aria-hidden className="size-4" />
          発注管理へ戻る
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">発注書情報</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="channel">
              発注元チャンネル<span className="text-destructive"> *</span>
            </Label>
            <select
              id="channel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border bg-card px-3 text-sm"
            >
              <option value="">選択してください</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="order_no">発注番号（任意）</Label>
            <Input
              id="order_no"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="mt-1 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="order_date">
              発注日<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="order_date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-1 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="note">備考</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 bg-card" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">発注書ファイル（CSV / Excel）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            「商品名」「数量」の列を含むCSVまたはExcelファイルを選択してください。
            登録済みの在庫品目と商品名が一致した行は自動でひも付きます。
            在庫が足りている行はこの画面での確定と同時に出荷登録され、
            足りない行は次の画面で「今回出荷できる分だけ出荷して残りを来月にまわす」などを判断できます。
          </p>
          <Input
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
            className="max-w-sm bg-card"
            aria-label="発注書ファイルを選択"
          />
          {fileName && <p className="text-sm">選択中のファイル: {fileName}</p>}
          {parseError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm">{parseError}</p>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">取り込みプレビュー（{rows.length}件）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ファイル上の商品名</TableHead>
                    <TableHead className="w-24">数量</TableHead>
                    <TableHead>在庫品目にひも付け</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>
                        <Input
                          value={r.item_name}
                          onChange={(e) => updateRow(r.key, { item_name: e.target.value })}
                          className="min-w-40 bg-card"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={r.quantity}
                          onChange={(e) =>
                            updateRow(r.key, { quantity: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-20 bg-card"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={r.matchedItemId}
                          onChange={(e) => updateRow(r.key, { matchedItemId: e.target.value })}
                          className="h-9 w-full min-w-48 rounded-lg border bg-card px-3 text-sm"
                        >
                          <option value="">未マッチ（あとで対応）</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.note}
                          onChange={(e) => updateRow(r.key, { note: e.target.value })}
                          className="min-w-32 bg-card"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeRow(r.key)}
                          aria-label="この行を取り込まない"
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addBlankRow}>
              行を手動で追加
            </Button>
          </CardContent>
        </Card>
      )}

      {submitError && (
        <p className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        <Button size="lg" disabled={submitting || rows.length === 0} onClick={confirm}>
          <FileUp aria-hidden className="size-4" />
          {submitting ? "取り込み中…" : "この内容で発注書を取り込む"}
        </Button>
      </div>
    </div>
  );
}

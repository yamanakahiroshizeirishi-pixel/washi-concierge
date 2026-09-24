"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import {
  computeLedger,
  currentStock,
  fiscalYearMonths,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/inventory";
import { MovementInputSchema, toMovementDbRow } from "@/lib/inventory-schema";
import type { InventoryChannel, InventoryItem, InventoryMovement, MovementType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

type MovementRaw = {
  movement_type: MovementType;
  channel_id: string;
  quantity: string;
  occurred_on: string;
  note: string;
};

function fiscalYearForDate(date: Date, startMonth: number): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= startMonth ? year : year - 1;
}

export function LedgerClient({
  item,
  fiscalYearStartMonth,
}: {
  item: InventoryItem;
  fiscalYearStartMonth: number;
}) {
  const [channels, setChannels] = useState<InventoryChannel[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState(() =>
    fiscalYearForDate(new Date(), fiscalYearStartMonth)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, watch, reset } = useForm<MovementRaw>({
    defaultValues: {
      movement_type: "incoming",
      channel_id: "",
      quantity: "1",
      occurred_on: today,
      note: "",
    },
  });
  const watchedType = watch("movement_type");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [channelsRes, movementsRes] = await Promise.all([
      supabase.from("inventory_channels").select("*").order("display_order").order("name"),
      supabase
        .from("inventory_movements")
        .select("*")
        .eq("item_id", item.id)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (channelsRes.error) setMessage(`読み込みに失敗しました: ${channelsRes.error.message}`);
    setChannels((channelsRes.data ?? []) as InventoryChannel[]);
    setMovements((movementsRes.data ?? []) as InventoryMovement[]);
    setLoading(false);
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(
    () => fiscalYearMonths(fiscalYearStartMonth, fiscalYear),
    [fiscalYearStartMonth, fiscalYear]
  );
  const testerChannelIds = useMemo(
    () => new Set(channels.filter((c) => c.channel_type === "internal").map((c) => c.id)),
    [channels]
  );
  const ledger = useMemo(
    () => computeLedger(item.purchase_price, movements, months, testerChannelIds),
    [item.purchase_price, movements, months, testerChannelIds]
  );
  const stockNow = useMemo(() => currentStock(movements), [movements]);
  const channelName = (id: string | null) =>
    id ? channels.find((c) => c.id === id)?.name ?? "（削除済みチャンネル）" : "—";

  const onSubmit = async (raw: MovementRaw) => {
    setErrors([]);
    const parsed = MovementInputSchema.safeParse({
      movement_type: raw.movement_type,
      channel_id: raw.movement_type === "shipment" ? raw.channel_id || null : null,
      quantity: raw.quantity,
      occurred_on: raw.occurred_on,
      note: raw.note,
    });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory_movements")
      .insert({ ...toMovementDbRow(parsed.data), item_id: item.id });
    setSaving(false);
    if (error) {
      setErrors([`登録に失敗しました: ${error.message}`]);
      return;
    }
    reset({ movement_type: "incoming", channel_id: "", quantity: "1", occurred_on: today, note: "" });
    setDialogOpen(false);
    load();
  };

  const removeMovement = async (m: InventoryMovement) => {
    if (!window.confirm("この入出庫記録を削除します。よろしいですか？")) return;
    const supabase = createClient();
    const { error } = await supabase.from("inventory_movements").delete().eq("id", m.id);
    if (error) {
      setMessage(`削除に失敗しました: ${error.message}`);
      return;
    }
    setMovements((prev) => prev.filter((x) => x.id !== m.id));
  };

  const monthLabel = (y: number, m: number) => `${y}/${m}`;

  const numberRow = (
    label: string,
    values: number[],
    opts?: { bold?: boolean; highlight?: boolean }
  ) => (
    <TableRow className={opts?.highlight ? "bg-secondary/60" : undefined}>
      <TableCell className={opts?.bold ? "font-medium" : "pl-6 text-muted-foreground"}>
        {label}
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={`text-right ${opts?.bold ? "font-medium" : ""}`}>
          {v.toLocaleString()}
        </TableCell>
      ))}
    </TableRow>
  );

  const yenRow = (label: string, values: number[], opts?: { bold?: boolean }) => (
    <TableRow>
      <TableCell className={opts?.bold ? "font-medium" : "pl-6 text-muted-foreground"}>
        {label}
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={`text-right ${opts?.bold ? "font-medium" : ""}`}>
          {yen(v)}
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            仕入価格 {item.purchase_price.toLocaleString()}円
            {item.supplier_name && ` ／ 仕入先: ${item.supplier_name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/inventory" />}>
            <ArrowLeft aria-hidden className="size-4" />
            一覧へ戻る
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus aria-hidden className="size-4" />
              入出庫を記録
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>入出庫を記録</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div>
                  <Label htmlFor="movement_type">区分</Label>
                  <select
                    id="movement_type"
                    {...register("movement_type")}
                    className="mt-1 h-9 w-full rounded-lg border bg-card px-3 text-sm"
                  >
                    {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {watchedType === "shipment" && (
                  <div>
                    <Label htmlFor="channel_id">出荷先チャンネル</Label>
                    <select
                      id="channel_id"
                      {...register("channel_id")}
                      className="mt-1 h-9 w-full rounded-lg border bg-card px-3 text-sm"
                    >
                      <option value="">選択してください</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.channel_type === "internal" ? "（社内消化）" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity">数量</Label>
                    <Input id="quantity" type="number" min={1} {...register("quantity")} className="mt-1 bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="occurred_on">日付</Label>
                    <Input id="occurred_on" type="date" {...register("occurred_on")} className="mt-1 bg-card" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="note">備考</Label>
                  <Input id="note" {...register("note")} className="mt-1 bg-card" />
                </div>
                {errors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm">
                    <ul className="list-inside list-disc">
                      {errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>
                    キャンセル
                  </DialogClose>
                  <Button type="submit" disabled={saving}>
                    {saving ? "登録中…" : "登録する"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge className="text-sm" variant={stockNow <= item.low_stock_threshold ? "destructive" : "outline"}>
          現在庫 {stockNow}
        </Badge>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={() => setFiscalYear((y) => y - 1)}>
            前年度
          </Button>
          <span className="font-medium">
            {fiscalYear}年度（{fiscalYearStartMonth}月始まり）
          </span>
          <Button variant="outline" size="sm" onClick={() => setFiscalYear((y) => y + 1)}>
            翌年度
          </Button>
        </div>
      </div>

      {message && <p className="rounded-md bg-secondary p-2 text-sm">{message}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">項目</TableHead>
                {ledger.map((row) => (
                  <TableHead key={`${row.year}-${row.month}`} className="text-right">
                    {monthLabel(row.year, row.month)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {numberRow("繰越（前月の在庫）", ledger.map((r) => r.opening))}
              {numberRow("入荷", ledger.map((r) => r.incoming))}
              {numberRow("① 合計（繰越+入荷）", ledger.map((r) => r.totalIn), { bold: true })}
              {channels.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6 text-muted-foreground">
                    出荷: {c.name}
                    {c.channel_type === "internal" && (
                      <span className="ml-1 text-xs">（社内消化）</span>
                    )}
                  </TableCell>
                  {ledger.map((row, i) => (
                    <TableCell key={i} className="text-right">
                      {(row.shipmentsByChannel[c.id] ?? 0).toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {ledger.some((r) => (r.shipmentsByChannel["unassigned"] ?? 0) > 0) &&
                numberRow(
                  "出荷: チャンネル未設定",
                  ledger.map((r) => r.shipmentsByChannel["unassigned"] ?? 0)
                )}
              {numberRow("② 合計（出荷）", ledger.map((r) => r.shipmentTotal), { bold: true })}
              {numberRow("返品戻り分", ledger.map((r) => r.returnIn))}
              {numberRow("返品分から処分", ledger.map((r) => r.returnDisposal))}
              {numberRow("返品からテスターに使用", ledger.map((r) => r.returnTester))}
              {numberRow("③ 返品から商品に戻し", ledger.map((r) => r.returnToStock), { bold: true })}
              {numberRow("在庫（①-②+③）", ledger.map((r) => r.ending), { bold: true, highlight: true })}
              {yenRow("見本品費", ledger.map((r) => r.sampleCost))}
              {yenRow("商品廃棄損", ledger.map((r) => r.disposalCost))}
              {yenRow("期末商品棚卸高（税込）", ledger.map((r) => r.endingValue), { bold: true })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-serif text-lg font-semibold">入出庫履歴（最新順）</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>区分</TableHead>
                <TableHead>チャンネル</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead>備考</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.slice(0, 50).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.occurred_on}</TableCell>
                  <TableCell>{MOVEMENT_TYPE_LABELS[m.movement_type]}</TableCell>
                  <TableCell>{channelName(m.channel_id)}</TableCell>
                  <TableCell className="text-right">{m.quantity}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {m.note ?? ""}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeMovement(m)}
                      aria-label="この記録を削除"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    入出庫の記録がありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

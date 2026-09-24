import type { InventoryItem, InventoryMovement, MovementType } from "./types";

// 在庫台帳（エクセルの「繰越→入荷→出荷→返品→在庫→期末棚卸高」の積み上げ式ロジック）

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  incoming: "入荷",
  shipment: "出荷",
  return_in: "返品戻り分",
  return_disposal: "返品分から処分",
  return_tester: "返品からテスターに使用",
  disposal: "商品廃棄損（直接）",
};

// 仕入価格(税抜)から評価用の税込単価を出す（エクセルの「＠726」のような期末棚卸評価と同じ考え方）
export function taxIncludedUnitCost(purchasePrice: number): number {
  return Math.round(purchasePrice * 1.1);
}

export function monthStartISO(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function nextMonth(year: number, month: number): [number, number] {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}

export function nextMonthStartISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  const [ny, nm] = nextMonth(d.getFullYear(), d.getMonth() + 1);
  return monthStartISO(ny, nm);
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}年${month}月`;
}

// fiscalYear年のstartMonth始まりの12ヶ月（例: startMonth=10, fiscalYear=2024 → 2024/10〜2025/9）
export function fiscalYearMonths(
  startMonth: number,
  fiscalYear: number
): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = fiscalYear;
  let m = startMonth;
  for (let i = 0; i < 12; i++) {
    out.push({ year: y, month: m });
    [y, m] = nextMonth(y, m);
  }
  return out;
}

function applyDelta(running: number, mv: InventoryMovement): number {
  switch (mv.movement_type) {
    case "incoming":
    case "return_in":
      return running + mv.quantity;
    case "shipment":
    case "return_disposal":
    case "return_tester":
    case "disposal":
      return running - mv.quantity;
    default:
      return running;
  }
}

// 現時点（全履歴）での在庫数
export function currentStock(movements: InventoryMovement[]): number {
  return movements.reduce((running, mv) => applyDelta(running, mv), 0);
}

export type MonthlyLedgerRow = {
  year: number;
  month: number;
  opening: number; // 繰越（前月の在庫）
  incoming: number; // 入荷
  totalIn: number; // ①合計（繰越+入荷）
  shipmentsByChannel: Record<string, number>; // channel_id -> 数量（"unassigned"はチャンネル未設定）
  shipmentTotal: number; // ②合計（出荷）
  returnIn: number; // 返品戻り分
  returnDisposal: number; // 返品分から処分
  returnTester: number; // 返品からテスターに使用
  returnToStock: number; // ③返品から商品に戻し
  disposal: number; // 商品廃棄損（直接）
  ending: number; // 在庫（①-②+③）
  sampleCost: number; // 見本品費（テスターチャンネルへの出荷×税込単価）
  disposalCost: number; // 商品廃棄損（返品処分+直接廃棄×税込単価）
  endingValue: number; // 期末商品棚卸高（税込）
};

export function computeLedger(
  purchasePrice: number,
  movements: InventoryMovement[],
  months: { year: number; month: number }[],
  testerChannelIds: Set<string>
): MonthlyLedgerRow[] {
  if (months.length === 0) return [];
  const unitCost = taxIncludedUnitCost(purchasePrice);
  const sorted = [...movements].sort((a, b) =>
    a.occurred_on.localeCompare(b.occurred_on)
  );
  const firstStart = monthStartISO(months[0].year, months[0].month);

  let idx = 0;
  let running = 0;
  while (idx < sorted.length && sorted[idx].occurred_on < firstStart) {
    running = applyDelta(running, sorted[idx]);
    idx++;
  }

  const rows: MonthlyLedgerRow[] = [];
  for (const { year, month } of months) {
    const [nY, nM] = nextMonth(year, month);
    const monthEnd = monthStartISO(nY, nM);
    const opening = running;

    const row: MonthlyLedgerRow = {
      year,
      month,
      opening,
      incoming: 0,
      totalIn: 0,
      shipmentsByChannel: {},
      shipmentTotal: 0,
      returnIn: 0,
      returnDisposal: 0,
      returnTester: 0,
      returnToStock: 0,
      disposal: 0,
      ending: 0,
      sampleCost: 0,
      disposalCost: 0,
      endingValue: 0,
    };

    while (idx < sorted.length && sorted[idx].occurred_on < monthEnd) {
      const mv = sorted[idx];
      switch (mv.movement_type) {
        case "incoming":
          row.incoming += mv.quantity;
          break;
        case "shipment": {
          const key = mv.channel_id ?? "unassigned";
          row.shipmentsByChannel[key] = (row.shipmentsByChannel[key] ?? 0) + mv.quantity;
          row.shipmentTotal += mv.quantity;
          if (mv.channel_id && testerChannelIds.has(mv.channel_id)) {
            row.sampleCost += mv.quantity * unitCost;
          }
          break;
        }
        case "return_in":
          row.returnIn += mv.quantity;
          break;
        case "return_disposal":
          row.returnDisposal += mv.quantity;
          row.disposalCost += mv.quantity * unitCost;
          break;
        case "return_tester":
          row.returnTester += mv.quantity;
          break;
        case "disposal":
          row.disposal += mv.quantity;
          row.disposalCost += mv.quantity * unitCost;
          break;
      }
      running = applyDelta(running, mv);
      idx++;
    }

    row.totalIn = row.opening + row.incoming;
    row.returnToStock = row.returnIn - row.returnDisposal - row.returnTester;
    row.ending = running;
    row.endingValue = row.ending * unitCost;
    rows.push(row);
  }

  return rows;
}

// ============ 発注書ファイルの取り込み ============

const NAME_KEYS = ["item_name", "商品名", "品名", "name", "商品", "製品名", "商品コード"];
const QTY_KEYS = ["quantity", "数量", "個数", "qty", "発注数", "発注数量", "本数"];
const NOTE_KEYS = ["note", "備考", "メモ", "notes"];

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const [key, value] of Object.entries(row)) {
    const trimmedKey = key.trim();
    if (keys.includes(trimmedKey) && value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

export type ParsedOrderRow = { item_name: string; quantity: number; note: string };

// CSV/XLSXをパースした行オブジェクト(ヘッダー名は表記ゆれを許容)から、商品名・数量・備考を抜き出す
export function parseOrderFileRows(rows: Record<string, unknown>[]): ParsedOrderRow[] {
  const out: ParsedOrderRow[] = [];
  for (const r of rows) {
    const nameRaw = pick(r, NAME_KEYS);
    if (nameRaw == null || String(nameRaw).trim() === "") continue;
    const qtyRaw = pick(r, QTY_KEYS);
    const qty = Number(qtyRaw);
    const noteRaw = pick(r, NOTE_KEYS);
    out.push({
      item_name: String(nameRaw).trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 0,
      note: noteRaw != null ? String(noteRaw).trim() : "",
    });
  }
  return out;
}

// 名前の完全一致（空白の差異は無視）で在庫品目を探す
export function matchItemByName(name: string, items: InventoryItem[]): InventoryItem | null {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const target = norm(name);
  return items.find((it) => norm(it.name) === target) ?? null;
}

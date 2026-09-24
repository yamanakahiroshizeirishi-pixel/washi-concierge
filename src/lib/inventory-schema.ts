import { z } from "zod";

// 在庫品目・チャンネル・入出庫記録の検証スキーマ

const toOptionalNum = () =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().nullable());

const toBool = (defaultValue: boolean) =>
  z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return ["true", "1", "はい", "yes", "TRUE"].includes(v.trim());
    return defaultValue;
  }, z.boolean());

export const InventoryItemInputSchema = z.object({
  sku: z.string().max(50).default(""),
  name: z.string().min(1, "商品名は必須です").max(200),
  supplier_name: z.string().max(200).default(""),
  purchase_price: z.preprocess(
    (v) => Number(v),
    z.number().min(0, "仕入価格は0以上で入力してください")
  ),
  wholesale_price: toOptionalNum(),
  low_stock_threshold: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  is_active: toBool(true).default(true),
  note: z.string().max(2000).default(""),
});
export type InventoryItemInput = z.infer<typeof InventoryItemInputSchema>;

export function toItemDbRow(input: InventoryItemInput) {
  return {
    ...input,
    sku: input.sku === "" ? null : input.sku,
    supplier_name: input.supplier_name === "" ? null : input.supplier_name,
    note: input.note === "" ? null : input.note,
  };
}

export const InventoryChannelInputSchema = z.object({
  name: z.string().min(1, "チャンネル名は必須です").max(100),
  channel_type: z.enum(["external", "internal"]).default("external"),
  display_order: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int()
  ).default(0),
});
export type InventoryChannelInput = z.infer<typeof InventoryChannelInputSchema>;

export const MovementInputSchema = z
  .object({
    movement_type: z.enum([
      "incoming",
      "shipment",
      "return_in",
      "return_disposal",
      "return_tester",
      "disposal",
    ]),
    channel_id: z.string().uuid().nullable().optional().default(null),
    quantity: z.preprocess(
      (v) => Number(v),
      z.number().int().min(1, "数量は1以上で入力してください")
    ),
    occurred_on: z.string().min(1, "日付は必須です"),
    note: z.string().max(500).default(""),
  })
  .refine((d) => d.movement_type !== "shipment" || !!d.channel_id, {
    message: "出荷の場合は出荷先チャンネルを選択してください",
    path: ["channel_id"],
  });
export type MovementInput = z.infer<typeof MovementInputSchema>;

export function toMovementDbRow(input: MovementInput) {
  return {
    movement_type: input.movement_type,
    channel_id: input.movement_type === "shipment" ? input.channel_id : null,
    quantity: input.quantity,
    occurred_on: input.occurred_on,
    note: input.note === "" ? null : input.note,
  };
}

export const PurchaseOrderHeaderSchema = z.object({
  order_no: z.string().max(100).default(""),
  channel_id: z.string().uuid({ message: "発注元チャンネルを選択してください" }),
  order_date: z.string().min(1, "発注日は必須です"),
  note: z.string().max(1000).default(""),
});
export type PurchaseOrderHeaderInput = z.infer<typeof PurchaseOrderHeaderSchema>;

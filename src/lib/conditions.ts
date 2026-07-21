import { z } from "zod";

// お客様の相談文から抽出する条件（指示書17章のJSON形式 + 枚数計算用の拡張項目）
export const ConditionsSchema = z.object({
  usage: z.string().catch("").default(""),
  budget_min: z.number().nullable().catch(null).default(null),
  budget_max: z.number().nullable().catch(null).default(null),
  preferred_colors: z.array(z.string()).catch([]).default([]),
  preferred_patterns: z.array(z.string()).catch([]).default([]),
  required_width_mm: z.number().nullable().catch(null).default(null),
  required_height_mm: z.number().nullable().catch(null).default(null),
  quantity: z.number().nullable().catch(null).default(null),
  printer_type: z.enum(["inkjet", "laser"]).nullable().catch(null).default(null),
  usage_environment: z.string().catch("").default(""),
  food_contact_required: z.boolean().catch(false).default(false),
  water_resistance_required: z.boolean().catch(false).default(false),
  heat_resistance_required: z.boolean().catch(false).default(false),
  gift_recipient: z.string().catch("").default(""),
  style_preference: z.string().catch("").default(""),
  missing_information: z.array(z.string()).catch([]).default([]),

  // ---- 拡張項目（必要枚数計算用） ----
  thickness_preference: z.string().catch("").default(""), // 薄口/中厚/厚口
  box_length_mm: z.number().nullable().catch(null).default(null), // 箱の縦(奥行)
  box_width_mm: z.number().nullable().catch(null).default(null), // 箱の横
  box_height_mm: z.number().nullable().catch(null).default(null), // 箱の高さ
  item_count: z.number().nullable().catch(null).default(null), // 包装する個数
  shoji_width_mm: z.number().nullable().catch(null).default(null), // 障子1枚の幅
  shoji_height_mm: z.number().nullable().catch(null).default(null), // 障子1枚の高さ
  shoji_count: z.number().nullable().catch(null).default(null), // 障子の枚数
  wall_width_mm: z.number().nullable().catch(null).default(null), // 壁面の幅
  wall_height_mm: z.number().nullable().catch(null).default(null), // 壁面の高さ
  wall_count: z.number().nullable().catch(null).default(null), // 面数
});

export type Conditions = z.infer<typeof ConditionsSchema>;

export function emptyConditions(): Conditions {
  return ConditionsSchema.parse({});
}

// 前回条件に新しい抽出結果を上書きマージする（会話条件の引き継ぎ）
export function mergeConditions(
  prev: Conditions,
  next: Partial<Conditions>
): Conditions {
  const merged: Conditions = { ...prev };
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "boolean" && value === false && key !== "_reset")
      continue; // false は「未指定」とみなす（明示解除は個別処理）
    // @ts-expect-error 動的キー代入
    merged[key] = value;
  }
  return ConditionsSchema.parse(merged);
}

// チャットAPIのリクエスト検証
export const ChatRequestSchema = z.object({
  sessionId: z.string().min(8).max(100),
  source: z.enum(["chat", "diagnosis", "line"]).default("chat"),
  message: z.string().min(1).max(2000),
  conditions: ConditionsSchema.nullable().default(null),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(30)
    .default([]),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ClickRequestSchema = z.object({
  productId: z.string().uuid(),
  logId: z.string().uuid().nullable().default(null),
  sessionId: z.string().max(100).nullable().default(null),
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Product,
  RecommendedItem,
  RelatedProductInfo,
  ScoreBreakdown,
  QuantityEstimate,
} from "./types";
import type { Conditions } from "./conditions";
import { calcWrapping, calcShoji, calcWall } from "./calc";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

// ---- 不足情報の判定と質問生成（1回につき最大3問） ----
export function buildQuestions(c: Conditions): {
  questions: string[];
  blocking: boolean;
} {
  const q: string[] = [];
  let blocking = false;

  if (!c.usage) {
    q.push(
      "どのような用途でお使いになりますか？（例：包装、障子の張り替え、印刷、書道、インテリアなど）"
    );
    if (!c.budget_max) q.push("ご予算はどのくらいをお考えですか？");
    return { questions: q.slice(0, 3), blocking: true };
  }

  switch (c.usage) {
    case "障子":
      if (!c.shoji_width_mm || !c.shoji_height_mm) {
        q.push("障子1枚の幅と高さを教えてください（例：幅90cm、高さ180cm）");
        blocking = true;
      }
      if (!c.shoji_count) {
        q.push("張り替える障子は何枚ですか？");
        blocking = true;
      }
      if (!blocking) break;
      q.push("ペットや小さなお子様はいらっしゃいますか？（破れにくい強化タイプもございます）");
      break;

    case "包装":
      if (!c.box_length_mm || !c.box_width_mm || !c.box_height_mm) {
        q.push(
          "包装する物の大きさを教えてください（例：縦30cm、横20cm、高さ10cmの箱）"
        );
        blocking = true;
        if (!c.item_count) q.push("何個包装されますか？");
        if (!c.budget_max) q.push("ご予算はいくらぐらいですか？");
      }
      break;

    case "食品包装":
      if (!c.box_length_mm && !c.required_width_mm) {
        q.push("包む食品の大きさはどのくらいですか？");
      }
      q.push("油分や水分の多い食品ですか？（その場合は食品用の内袋との併用をおすすめします）");
      break;

    case "印刷":
    case "名刺":
    case "招待状":
      if (!c.printer_type) {
        q.push(
          "お使いのプリンターはインクジェットとレーザーのどちらですか？"
        );
        blocking = true;
      }
      if (!c.required_width_mm) {
        q.push("印刷する用紙サイズを教えてください（A4、はがきサイズなど）");
      }
      if (!c.quantity) {
        q.push("必要な枚数は何枚ぐらいですか？");
      }
      break;

    case "ギフト":
    case "海外土産":
      if (!c.budget_max) {
        q.push("ご予算はいくらぐらいですか？");
        blocking = true;
      }
      if (!c.gift_recipient) q.push("どなたへの贈り物ですか？");
      break;

    case "照明":
      if (!c.heat_resistance_required) {
        q.push(
          "光源はLEDですか、白熱電球ですか？（白熱電球は高温になるため対応商品が限られます）"
        );
      }
      break;

    case "インテリア":
    case "店舗装飾":
      if (!c.wall_width_mm && !c.quantity) {
        q.push("使用する面の大きさ（幅×高さ）が分かれば教えてください。必要枚数の目安を計算できます。");
      }
      break;
  }

  return { questions: q.slice(0, 3), blocking };
}

// ---- データベースからの候補絞り込み ----
export async function fetchCandidates(
  supabase: SupabaseClient,
  c: Conditions
): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_published", true)
    .gt("stock_quantity", 0)
    .neq("category", "加工用品")
    .limit(24);

  if (c.usage === "食品包装") {
    query = query.eq("food_contact_compatible", true);
  } else if (c.usage) {
    query = query.contains("usage_tags", [c.usage]);
  }
  if (c.printer_type === "inkjet") query = query.eq("inkjet_compatible", true);
  if (c.printer_type === "laser")
    query = query.eq("laser_printer_compatible", true);
  if (c.food_contact_required)
    query = query.eq("food_contact_compatible", true);
  if (c.water_resistance_required) query = query.eq("water_resistant", true);
  if (c.heat_resistance_required) query = query.eq("heat_resistant", true);
  if (c.usage_environment === "屋外") query = query.eq("outdoor_compatible", true);
  if (c.budget_max) {
    // 単価が予算を超える商品は原則除外（総額は点数計算で評価）
    query = query.lte("tax_included_price", c.budget_max);
  }

  const { data, error } = await query;
  if (error) throw new Error(`商品検索に失敗しました: ${error.message}`);
  return (data ?? []) as Product[];
}

// ---- 必要枚数の見積り（商品サイズが分かる場合のみ） ----
export function estimateQuantity(
  p: Product,
  c: Conditions
): QuantityEstimate | null {
  if (!p.width_mm || !p.height_mm) return null;
  if (
    (c.usage === "包装" || c.usage === "食品包装") &&
    c.box_length_mm &&
    c.box_width_mm &&
    c.box_height_mm
  ) {
    return calcWrapping(
      c.box_length_mm,
      c.box_width_mm,
      c.box_height_mm,
      c.item_count ?? 1,
      p.width_mm,
      p.height_mm
    );
  }
  if (c.usage === "障子" && c.shoji_width_mm && c.shoji_height_mm) {
    return calcShoji(
      c.shoji_width_mm,
      c.shoji_height_mm,
      c.shoji_count ?? 1,
      p.width_mm,
      p.height_mm
    );
  }
  if (
    (c.usage === "インテリア" || c.usage === "店舗装飾") &&
    c.wall_width_mm &&
    c.wall_height_mm
  ) {
    return calcWall(
      c.wall_width_mm,
      c.wall_height_mm,
      c.wall_count ?? 1,
      p.width_mm,
      p.height_mm
    );
  }
  return null;
}

// ---- 推薦点数計算（用途30 / サイズ20 / 予算15 / 色10 / 柄10 / 厚さ10 / 在庫5） ----
export function scoreProduct(
  p: Product,
  c: Conditions
): { score: ScoreBreakdown; quantity: QuantityEstimate | null; estimatedTotal: number | null } {
  const reasons: string[] = [];
  const quantity = estimateQuantity(p, c);

  // 概算金額: 枚数が計算できれば 枚数×税込単価、指定枚数があればその枚数分
  let estimatedTotal: number | null = null;
  if (quantity) {
    estimatedTotal = quantity.sheets * p.tax_included_price;
  } else if (c.quantity && p.width_mm && p.height_mm) {
    estimatedTotal = c.quantity * p.tax_included_price;
  }

  // 用途 30点
  let usage = 0;
  if (!c.usage) {
    usage = 15;
  } else if (
    p.usage_tags.includes(c.usage) ||
    (c.usage === "食品包装" && p.food_contact_compatible)
  ) {
    usage = 30;
    reasons.push(`用途「${c.usage}」に対応しています`);
  } else if (p.recommended_uses.join("、").includes(c.usage)) {
    usage = 20;
    reasons.push(`おすすめ用途に「${c.usage}」が含まれます`);
  }

  // サイズ 20点
  let size = 10;
  if (quantity) {
    if ((quantity.perUnit ?? 99) <= 1) {
      size = 20;
      reasons.push("1枚で覆えるサイズです");
    } else if ((quantity.perUnit ?? 99) <= 2) {
      size = 12;
      reasons.push("2枚のつなぎ合わせで対応できます");
    } else {
      size = 5;
    }
  } else if (c.required_width_mm && c.required_height_mm && p.width_mm && p.height_mm) {
    const fits =
      (p.width_mm >= c.required_width_mm && p.height_mm >= c.required_height_mm) ||
      (p.width_mm >= c.required_height_mm && p.height_mm >= c.required_width_mm);
    const exact =
      Math.abs(p.width_mm - c.required_width_mm) <= 5 &&
      Math.abs(p.height_mm - c.required_height_mm) <= 5;
    if (exact) {
      size = 20;
      reasons.push("ご希望のサイズにぴったりです");
    } else if (fits) {
      size = 14;
      reasons.push("ご希望サイズを裁ち出せる大きさです");
    } else {
      size = 0;
    }
  }

  // 予算 15点
  let budget = 8;
  if (c.budget_max) {
    const cost = estimatedTotal ?? p.tax_included_price;
    if (cost <= c.budget_max) {
      budget = 15;
      reasons.push(
        estimatedTotal
          ? `概算${yen(cost)}でご予算内です`
          : `税込${yen(p.tax_included_price)}でご予算内です`
      );
    } else if (cost <= c.budget_max * 1.15) {
      budget = 6;
      reasons.push(`概算${yen(cost)}でご予算をわずかに超えます`);
    } else {
      budget = 0;
    }
  }

  // 色 10点
  let color = 5;
  if (c.preferred_colors.length > 0) {
    const hit = c.preferred_colors.filter((t) => p.color_tags.includes(t));
    if (hit.length > 0) {
      color = 10;
      reasons.push(`ご希望の色（${hit.join("・")}）に合っています`);
    } else {
      color = 0;
    }
  }

  // 柄 10点
  let pattern = 5;
  if (c.preferred_patterns.length > 0) {
    const hit = c.preferred_patterns.filter((t) => p.pattern_tags.includes(t));
    if (hit.length > 0) {
      pattern = 10;
      reasons.push(`ご希望の柄（${hit.join("・")}）に合っています`);
    } else {
      pattern = 0;
    }
  }

  // 厚さ・強度 10点
  let thickness = 5;
  if (c.thickness_preference) {
    if (p.thickness === c.thickness_preference) {
      thickness = 10;
      reasons.push(`厚さ（${p.thickness}）がご希望どおりです`);
    } else {
      thickness = 2;
    }
  } else if (c.usage === "障子" && (p.strength_level ?? 0) >= 4) {
    thickness = 10;
    reasons.push("破れにくい強化タイプです");
  }

  // 在庫 5点
  const lowStock = p.stock_quantity <= p.low_stock_threshold;
  const stock = lowStock ? 3 : 5;
  if (lowStock) reasons.push(`在庫残りわずか（${p.stock_quantity}点）`);

  const total = usage + size + budget + color + pattern + thickness + stock;
  return {
    score: { usage, size, budget, color, pattern, thickness, stock, total, reasons },
    quantity,
    estimatedTotal,
  };
}

// ---- 関連商品の取得（公開商品のみ・RLSでも保護） ----
async function fetchRelated(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, RelatedProductInfo[]>> {
  const map = new Map<string, RelatedProductInfo[]>();
  if (productIds.length === 0) return map;
  const { data } = await supabase
    .from("related_products")
    .select(
      "product_id, relation_type, display_order, related:products!related_products_related_product_id_fkey(id, name, category, tax_included_price, stock_quantity, purchase_url, is_published)"
    )
    .in("product_id", productIds)
    .order("display_order");
  for (const row of data ?? []) {
    const rel = row.related as unknown as {
      id: string;
      name: string;
      category: string;
      tax_included_price: number;
      stock_quantity: number;
      purchase_url: string | null;
      is_published: boolean;
    } | null;
    if (!rel || !rel.is_published || rel.stock_quantity <= 0) continue;
    const list = map.get(row.product_id) ?? [];
    list.push({
      id: rel.id,
      name: rel.name,
      category: rel.category,
      tax_included_price: rel.tax_included_price,
      stock_quantity: rel.stock_quantity,
      purchase_url: rel.purchase_url,
      relation_type: row.relation_type,
    });
    map.set(row.product_id, list);
  }
  return map;
}

// ---- メイン: 絞り込み → 点数化 → 上位3件 + 関連商品 ----
export async function recommendProducts(
  supabase: SupabaseClient,
  c: Conditions
): Promise<RecommendedItem[]> {
  const candidates = await fetchCandidates(supabase, c);
  const scored = candidates
    .map((p) => {
      const { score, quantity, estimatedTotal } = scoreProduct(p, c);
      return {
        product: p,
        score,
        quantity,
        estimatedTotal,
        lowStock: p.stock_quantity <= p.low_stock_threshold,
        related: [] as RelatedProductInfo[],
      };
    })
    // 用途不一致(0点)は提案しない
    .filter((item) => item.score.usage > 0 || !c.usage)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 3);

  const relatedMap = await fetchRelated(
    supabase,
    scored.map((s) => s.product.id)
  );
  for (const item of scored) {
    item.related = (relatedMap.get(item.product.id) ?? []).slice(0, 3);
  }
  return scored;
}

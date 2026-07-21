import { type Conditions, ConditionsSchema } from "./conditions";

// ---- ルールベースの条件抽出（AIキーなしでも動作する基盤。LLM抽出のフォールバックにも使用） ----

const COLOR_KEYWORDS: [RegExp, string][] = [
  [/白|ホワイト/, "白"],
  [/生成り|きなり|ナチュラル/, "生成り"],
  [/赤|朱|茜|桜色|ピンク/, "赤系"],
  [/青|藍|紺|ブルー/, "青系"],
  [/緑|グリーン|抹茶/, "緑系"],
  [/黄|山吹|イエロー/, "黄色系"],
  [/金|銀|ゴールド|シルバー/, "金・銀"],
  [/淡い|薄い色|パステル/, "淡い色"],
  [/落ち着い|渋い|シック/, "落ち着いた色"],
  [/鮮やか|カラフル|ビビッド/, "鮮やかな色"],
];

const PATTERN_KEYWORDS: [RegExp, string][] = [
  [/無地|柄なし|柄無し|シンプル/, "無地"],
  [/花柄|花模様/, "花柄"],
  [/和柄|和模様/, "和柄"],
  [/幾何学/, "幾何学柄"],
  [/季節柄|春柄|秋柄/, "季節柄"],
  [/金銀入り|金銀の/, "金銀入り"],
  [/手すき模様|雲龍/, "手すき模様"],
];

function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９．]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/，/g, ",")
    .replace(/、(?=\d)/g, ",");
}

function parseAmount(raw: string): number | null {
  const s = raw.replace(/,/g, "");
  const man = s.match(/([\d.]+)\s*万/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);
  const num = s.match(/[\d.]+/);
  return num ? Math.round(parseFloat(num[0])) : null;
}

// 「30cm」「300mm」「30センチ」→ mm
function toMm(value: number, unit: string): number {
  return /mm|ミリ/.test(unit) ? value : value * 10;
}

const DIM = "([\\d.]+)\\s*(cm|mm|センチ|ミリ)";

function matchDim(text: string, label: string): number | null {
  const m = text.match(new RegExp(`${label}\\s*[:：は]?\\s*${DIM}`));
  return m ? toMm(parseFloat(m[1]), m[2]) : null;
}

const PAPER_SIZES: Record<string, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  B4: [257, 364],
  B5: [182, 257],
  はがき: [100, 148],
  ハガキ: [100, 148],
};

export function extractRuleBased(input: string, prev: Conditions): Conditions {
  const text = toHalfWidth(input);
  const c: Conditions = ConditionsSchema.parse({ ...prev });

  // ---- 予算 ----
  const range = text.match(/([\d.,万]+)\s*[~〜～ー-]\s*([\d.,万]+)\s*円/);
  const budgetA = text.match(/予算[はがもは]?\s*([\d.,万]+)\s*円?/);
  const budgetB = text.match(/([\d.,万]+)\s*円\s*(以内|以下|くらい|ぐらい|程度|まで|前後)/);
  if (range) {
    c.budget_min = parseAmount(range[1]);
    c.budget_max = parseAmount(range[2]);
  } else if (budgetA?.[1] && parseAmount(budgetA[1])) {
    c.budget_max = parseAmount(budgetA[1]);
  } else if (budgetB) {
    c.budget_max = parseAmount(budgetB[1]);
  }
  if (/もう少し安|もっと安|安いもの|安めの|予算を下げ/.test(text)) {
    c.budget_max = c.budget_max ? Math.round(c.budget_max * 0.7) : 1000;
  }
  if (/もう少し高|もっと高|予算を上げ|高くてもいい/.test(text) && c.budget_max) {
    c.budget_max = Math.round(c.budget_max * 1.5);
  }

  // ---- 色（「AではなくB」は後半だけを採用して置き換え） ----
  const notMatch = text.match(/ではなく|じゃなく/);
  const colorTarget = notMatch ? text.slice(text.search(/ではなく|じゃなく/)) : text;
  const foundColors = COLOR_KEYWORDS.filter(([re]) => re.test(colorTarget)).map(
    ([, tag]) => tag
  );
  if (foundColors.length > 0) {
    c.preferred_colors = notMatch
      ? foundColors
      : Array.from(new Set([...c.preferred_colors, ...foundColors]));
  }
  // 「赤すぎない」などの否定表現は除外する
  for (const [re, tag] of COLOR_KEYWORDS) {
    const src = re.source.split("|")[0];
    if (new RegExp(`${src}(すぎない|は避け|以外)`).test(text)) {
      c.preferred_colors = c.preferred_colors.filter((t) => t !== tag);
    }
  }

  // ---- 柄 ----
  const foundPatterns = PATTERN_KEYWORDS.filter(([re]) =>
    re.test(colorTarget)
  ).map(([, tag]) => tag);
  if (foundPatterns.length > 0) {
    c.preferred_patterns = notMatch
      ? foundPatterns
      : Array.from(new Set([...c.preferred_patterns, ...foundPatterns]));
  }
  if (/柄なし|柄無し|無地がいい|無地がよい/.test(text)) {
    c.preferred_patterns = ["無地"];
  }

  // ---- 厚さ ----
  if (/厚い|厚手|厚口|厚めの|もっと厚/.test(text)) c.thickness_preference = "厚口";
  else if (/薄い|薄手|薄口|薄めの/.test(text)) c.thickness_preference = "薄口";
  else if (/中厚/.test(text)) c.thickness_preference = "中厚";

  // ---- プリンター ----
  if (/インクジェット/.test(text)) c.printer_type = "inkjet";
  else if (/レーザー/.test(text)) c.printer_type = "laser";

  // ---- 用途（優先順に判定） ----
  const foodWord = /(食品|食べ物|お菓子|菓子|パン|おにぎり|和菓子)/.test(text);
  const wrapWord = /(包|巻|ラッピング)/.test(text);
  if (/障子/.test(text)) {
    c.usage = "障子";
  } else if (foodWord && wrapWord) {
    if (/直接/.test(text)) {
      c.usage = "食品包装";
      c.food_contact_required = true;
    } else {
      c.usage = "包装";
    }
  } else if (/印刷|プリント|プリンタ/.test(text)) {
    c.usage = "印刷";
  } else if (/名刺/.test(text)) {
    c.usage = "名刺";
  } else if (/招待状/.test(text)) {
    c.usage = "招待状";
  } else if (/書道|習字|書き初め|半紙/.test(text)) {
    c.usage = "書道";
  } else if (/絵画|日本画|水彩|水墨|絵を描/.test(text)) {
    c.usage = "絵画";
  } else if (/照明|ランプ|ライト|行灯|あんどん/.test(text)) {
    c.usage = "照明";
  } else if (/工作|折り紙|ちぎり絵|クラフト|貼り絵/.test(text)) {
    c.usage = "工作";
  } else if (/店舗.{0,4}(内装|装飾|ディスプレイ)|お店の(内装|飾り)/.test(text)) {
    c.usage = "店舗装飾";
  } else if (/インテリア|内装|壁に|壁面/.test(text)) {
    c.usage = "インテリア";
  } else if (/海外|お土産|土産|外国/.test(text)) {
    c.usage = "海外土産";
  } else if (/包装|包み|包む|ラッピング/.test(text)) {
    c.usage = "包装";
  } else if (/ギフト|贈り物|プレゼント|祝い/.test(text)) {
    c.usage = "ギフト";
  }

  // 「結婚祝いの包み紙」のように包装+祝いが同時に出る場合は包装を優先しつつ贈る相手を記録
  if (/結婚祝/.test(text)) c.gift_recipient = "結婚祝い";
  else if (/出産祝/.test(text)) c.gift_recipient = "出産祝い";
  else if (/海外の友人|友人|友達/.test(text)) c.gift_recipient = c.gift_recipient || "友人";
  else if (/上司|目上/.test(text)) c.gift_recipient = "目上の方";

  // ---- 使用環境 ----
  if (/屋外|外で使/.test(text)) {
    c.usage_environment = "屋外";
    c.water_resistance_required = true;
  } else if (/水回り|水まわり|水に触れ/.test(text)) {
    c.usage_environment = "水回り";
    c.water_resistance_required = true;
  } else if (/屋内|室内/.test(text)) {
    c.usage_environment = "屋内";
  }
  if (/白熱|高温|熱くなる/.test(text)) c.heat_resistance_required = true;
  if (/LED|ＬＥＤ/.test(input)) c.heat_resistance_required = false;

  // ---- 寸法 ----
  const tate = matchDim(text, "縦");
  const yoko = matchDim(text, "横");
  const takasa = matchDim(text, "高さ");
  const haba = matchDim(text, "幅");

  if (c.usage === "障子") {
    if (haba) c.shoji_width_mm = haba;
    if (takasa) c.shoji_height_mm = takasa;
    if (tate && !c.shoji_height_mm) c.shoji_height_mm = tate;
    if (yoko && !c.shoji_width_mm) c.shoji_width_mm = yoko;
  } else if (c.usage === "インテリア" || c.usage === "店舗装飾") {
    if (haba) c.wall_width_mm = haba;
    if (takasa) c.wall_height_mm = takasa;
  } else if (takasa && (tate || yoko)) {
    // 高さがある → 箱の寸法とみなす（包装）
    if (tate) c.box_length_mm = tate;
    if (yoko) c.box_width_mm = yoko;
    if (haba && !c.box_width_mm) c.box_width_mm = haba;
    c.box_height_mm = takasa;
  } else {
    if (yoko || haba) c.required_width_mm = yoko ?? haba;
    if (tate) c.required_height_mm = tate;
  }

  // 定型用紙サイズ（A4など）
  for (const [key, [w, h]] of Object.entries(PAPER_SIZES)) {
    if (text.includes(key)) {
      c.required_width_mm = w;
      c.required_height_mm = h;
      break;
    }
  }

  // ---- 数量 ----
  // 「障子1枚は幅90cm」のような寸法説明の「1枚は/1枚あたり」は数量として扱わない
  const sheetsMatch = text.match(/(\d+)\s*枚(?!は|あたり|につき|のサイズ|の大きさ)/);
  if (sheetsMatch) {
    const n = parseInt(sheetsMatch[1], 10);
    if (c.usage === "障子") c.shoji_count = n;
    else c.quantity = n;
  }
  const pieces = text.match(/(\d+)\s*個/);
  if (pieces) c.item_count = parseInt(pieces[1], 10);
  const faces = text.match(/(\d+)\s*面/);
  if (faces) c.wall_count = parseInt(faces[1], 10);

  return ConditionsSchema.parse(c);
}

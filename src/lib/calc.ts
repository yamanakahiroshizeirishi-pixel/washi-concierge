import type { QuantityEstimate } from "./types";

// すべて mm 単位で計算する
const round1 = (n: number) => Math.round(n * 10) / 10;

function tileCount(
  needW: number,
  needH: number,
  sheetW: number,
  sheetH: number
): number {
  // 縦横どちらの向きで使ってもよいものとして、少ない方の枚数を採用
  const a = Math.ceil(needW / sheetW) * Math.ceil(needH / sheetH);
  const b = Math.ceil(needW / sheetH) * Math.ceil(needH / sheetW);
  return Math.max(1, Math.min(a, b));
}

// 包装紙: 箱の縦(奥行)・横・高さから必要な紙面を求める
// 紙の幅 = 胴回り 2×(横+高さ) + 重なり30mm / 紙の奥行 = 縦 + 高さ×1.5 + 余白20mm
export function calcWrapping(
  boxLength: number,
  boxWidth: number,
  boxHeight: number,
  count: number,
  sheetW: number,
  sheetH: number
): QuantityEstimate {
  const needA = 2 * (boxWidth + boxHeight) + 30;
  const needB = boxLength + boxHeight * 1.5 + 20;
  const perUnit = tileCount(needA, needB, sheetW, sheetH);
  const sheets = Math.ceil(perUnit * count * 1.1); // 失敗分として10%の予備
  const joins =
    perUnit > 1 ? `紙をつなぎ合わせて包む必要があります（1個あたり${perUnit}枚）。` : "";
  return {
    sheets,
    perUnit,
    explanation:
      `箱（縦${round1(boxLength / 10)}×横${round1(boxWidth / 10)}×高さ${round1(boxHeight / 10)}cm）を包むには` +
      `約${Math.round(needA)}×${Math.round(needB)}mmの紙面が必要です（重なり・折り込み分を含む）。` +
      `${joins}${count}個分に失敗時の予備10%を加えて${sheets}枚が目安です。`,
  };
}

// 障子紙: 貼りしろとして各辺+40mmを見込む
export function calcShoji(
  shojiWidth: number,
  shojiHeight: number,
  count: number,
  sheetW: number,
  sheetH: number
): QuantityEstimate {
  const needW = shojiWidth + 40;
  const needH = shojiHeight + 40;
  const perUnit = tileCount(needW, needH, sheetW, sheetH);
  const sheets = Math.ceil(perUnit * count * 1.1);
  const joins =
    perUnit > 1
      ? `この商品1枚では障子1枚を覆えないため、つなぎ貼りが必要です（障子1枚あたり${perUnit}枚）。`
      : "";
  return {
    sheets,
    perUnit,
    explanation:
      `障子1枚（幅${round1(shojiWidth / 10)}×高さ${round1(shojiHeight / 10)}cm）に貼りしろ各4cmを見込みます。` +
      `${joins}${count}枚分に失敗時の予備10%を加えて${sheets}枚が目安です。`,
  };
}

// 壁面・内装: 施工ロスとして12%を加算
export function calcWall(
  wallWidth: number,
  wallHeight: number,
  faces: number,
  sheetW: number,
  sheetH: number
): QuantityEstimate {
  const perFace = tileCount(wallWidth, wallHeight, sheetW, sheetH);
  const sheets = Math.ceil(perFace * faces * 1.12);
  return {
    sheets,
    perUnit: perFace,
    explanation:
      `幅${round1(wallWidth / 10)}×高さ${round1(wallHeight / 10)}cmの面を覆うには1面あたり約${perFace}枚必要です。` +
      `${faces}面分に施工ロス12%を加えて${sheets}枚が目安です。`,
  };
}

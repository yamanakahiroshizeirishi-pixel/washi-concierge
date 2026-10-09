import { NextResponse } from "next/server";

export const runtime = "nodejs";

// スキャン画像・PDFの発注書をAI（Anthropic API）に読み取らせる。
// claude.aiのArtifact機能とは違い、サーバー側のAPIキーで直接呼び出すため、
// 「この表示環境では画像を送れません」という制限を受けない。

type AiLine = {
  item_name: string;
  quantity: number;
  unit_price: number | null;
  amount: number | null;
  product_code: string | null;
  matched_name: string | null;
  candidates: string[];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,，円¥@\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEYが設定されていません。Vercelのプロジェクト設定（環境変数）で設定してください。",
      },
      { status: 500 }
    );
  }

  let file: File;
  let itemNames: string[];
  try {
    const form = await request.formData();
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "ファイルが送信されていません" }, { status: 400 });
    }
    file = fileEntry;
    const rawNames = form.get("item_names");
    itemNames = (() => {
      try {
        const parsed = rawNames ? JSON.parse(String(rawNames)) : [];
        return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string") : [];
      } catch {
        return [];
      }
    })();
  } catch (e) {
    return NextResponse.json(
      { error: `送信内容を読み取れませんでした: ${e instanceof Error ? e.message : ""}` },
      { status: 400 }
    );
  }

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const mediaType = isPdf ? "application/pdf" : file.type || "image/jpeg";
  if (!isPdf && !/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) {
    return NextResponse.json(
      { error: "PDF、またはJPEG/PNG/WebP画像のみ読み取れます" },
      { status: 400 }
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const prompt = [
    "次の画像（またはPDF）は、日本語の「発注書」をスキャンまたは撮影したものです。",
    "私たち（仕入先欄に「御中」と書かれている側）が、この発注書を出した取引先から受けた注文です。",
    "",
    "【明細】表の番号付きの行を、上から順にすべて読み取ってください。空の行は飛ばします。",
    "- product_code: 「商品コード」欄の数字（JANコードなど。無ければ null）",
    "- item_name: 「品名」欄の商品名だけ。品名欄は2段になっていることがあり、1段目が商品名、2段目に「@850」「¥81,600」のような数字が書かれています。数字は item_name に含めないでください。半角カナは全角カナに直してください。",
    "- unit_price: 「@」の後の数字が単価です（例：@1100 → 1100）。「単価」欄があればその数字。無ければ null。",
    "- amount: 「¥」の後の数字は金額（単価×数量）です。単価と取り違えないでください。無ければ null。",
    "- quantity: 「発注数」欄の数（「個」などの単位は除いた整数）。「訂正数」欄に数字が書かれていれば、それを優先してください。読めなければ null。",
    "合計・小計・消費税・送料の行、見出しは含めないでください。読めない文字を推測で埋めないでください。",
    "",
    ...(itemNames.length
      ? [
          "【品目の照合】こちらで管理している在庫品目名です：",
          ...itemNames.map((n) => `- ${n}`),
          "matched_name には、一覧のうち同じ商品だと確実に言えるものが1つだけあるときに、その品目名を一覧の表記どおり入れてください。",
          "一覧の複数の品目に当てはまり得るときは matched_name を null にし、当てはまり得る品目名を candidates に入れてください。",
          "",
        ]
      : []),
    "【発注書の情報】読めなければ null にしてください。",
    "- order_from: 発注書を出した会社名（ロゴや社名欄。仕入先欄の「御中」の相手ではありません）",
    "- ship_to: 「倉庫名」などの納品先",
    "- order_no: 「発注番号」",
    "- order_date: 「発注日」を YYYY-MM-DD で。年が2桁なら20XX年として解釈してください（例：26/9/24 → 2026-09-24）。",
    "- due_date: 「入荷予定日」「納期」を同じ形式で",
    "",
    "次の形のJSONだけを返してください（説明文は不要。値は例です）：",
    '{"order_from": "株式会社〇〇", "ship_to": "〇〇センター", "order_no": "00000000", "order_date": "2026-01-05", "due_date": "2026-01-07", "lines": [{"product_code": "4500000000000", "item_name": "〇〇 トリートメントオイル", "unit_price": 1100, "amount": 13200, "quantity": 12, "matched_name": "トリートメントオイル", "candidates": []}]}',
  ].join("\n");

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-sonnet-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `AIへの接続に失敗しました: ${e instanceof Error ? e.message : ""}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `AIの呼び出しに失敗しました（${res.status}）: ${errText.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const json = await res.json();
  const text: string = json.content?.[0]?.text ?? "";
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    return NextResponse.json(
      { error: "AIの回答から明細を読み取れませんでした。手動で入力してください。" },
      { status: 422 }
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      { error: "AIの回答をJSONとして解釈できませんでした。もう一度お試しください。" },
      { status: 422 }
    );
  }

  const rawLines = Array.isArray(parsed.lines) ? (parsed.lines as unknown[]) : [];
  const lines: AiLine[] = rawLines
    .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : null))
    .filter((l): l is Record<string, unknown> => l != null && str(l.item_name) != null)
    .map((l) => {
      const qty = num(l.quantity);
      return {
        item_name: str(l.item_name)!.normalize("NFKC"),
        quantity: qty && qty > 0 ? Math.round(qty) : 0,
        unit_price: num(l.unit_price),
        amount: num(l.amount),
        product_code: str(l.product_code)?.replace(/\s/g, "") ?? null,
        matched_name: str(l.matched_name),
        candidates: Array.isArray(l.candidates)
          ? (l.candidates as unknown[]).filter((c): c is string => typeof c === "string")
          : [],
      };
    });

  return NextResponse.json({
    order_from: str(parsed.order_from),
    ship_to: str(parsed.ship_to),
    order_no: str(parsed.order_no),
    order_date: str(parsed.order_date),
    due_date: str(parsed.due_date),
    lines,
  });
}

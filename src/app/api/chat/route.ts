import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ChatRequestSchema, emptyConditions } from "@/lib/conditions";
import { buildQuestions, recommendProducts } from "@/lib/recommend";
import {
  extractConditions,
  generateConciergeResponse,
} from "@/lib/ai/provider";
import type { AppSettings } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力内容を確認してください。" },
        { status: 400 }
      );
    }
    const {
      sessionId,
      source,
      message,
      conditions: prevConditions,
      history,
    } = parsed.data;

    const supabase = await createClient();

    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle<AppSettings>();

    // 1) 条件抽出（前回条件を引き継いでマージ）
    const conditions = await extractConditions(
      message,
      prevConditions ?? emptyConditions()
    );

    // 2) 不足情報の判定
    const { questions, blocking } = buildQuestions(conditions);

    // 3) 商品推薦（情報が足りない場合は提案しない）
    const items = blocking ? [] : await recommendProducts(supabase, conditions);
    const couldNotAnswer = !blocking && !!conditions.usage && items.length === 0;

    // 4) 提案文生成（AIまたはルールベース）
    const safeHistory = history
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
    const reply = await generateConciergeResponse({
      settings: settings ?? null,
      history: [...safeHistory, { role: "user", content: message }],
      conditions,
      items,
      questions,
      couldNotAnswer,
    });

    // 5) 相談履歴の保存（個人情報は保存しない）
    //    匿名ロールには consultation_logs の SELECT 権限がない（RLSで write-only）。
    //    そのため id をサーバー側で採番し、RETURNING を伴わない insert にする。
    const logId = crypto.randomUUID();
    const { error: logError } = await supabase.from("consultation_logs").insert({
      id: logId,
      session_id: sessionId,
      source,
      customer_question: message.slice(0, 2000),
      extracted_conditions: conditions,
      ai_response: reply.slice(0, 8000),
      recommended_product_ids: items.map((i) => i.product.id),
      recommendation_scores: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        ...i.score,
      })),
      could_not_answer: couldNotAnswer,
    });
    if (logError) console.error("consultation_logs insert error:", logError);

    return NextResponse.json({
      message: reply,
      items,
      conditions,
      questions,
      couldNotAnswer,
      logId,
    });
  } catch (e) {
    console.error("chat api error:", e);
    return NextResponse.json(
      {
        error:
          "申し訳ございません。一時的な不具合が発生しました。少し時間をおいてもう一度お試しください。",
      },
      { status: 500 }
    );
  }
}

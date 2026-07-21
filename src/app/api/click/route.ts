import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ClickRequestSchema } from "@/lib/conditions";

// 購入ページへのクリックを記録する（分析用・個人情報なし）
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = ClickRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const supabase = await createClient();
    await supabase.from("product_clicks").insert({
      product_id: parsed.data.productId,
      consultation_log_id: parsed.data.logId,
      session_id: parsed.data.sessionId,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

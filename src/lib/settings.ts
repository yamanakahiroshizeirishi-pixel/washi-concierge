import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/types";

const DEFAULTS: AppSettings = {
  id: 1,
  store_name: "和紙の店",
  app_name: "AI和紙コンシェルジュ",
  logo_url: null,
  ai_notes: null,
};

// アプリ設定（店名・アプリ名・ロゴ）。取得に失敗しても画面が止まらないよう既定値を返す
export async function getSettings(): Promise<AppSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle<AppSettings>();
    return data ?? DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export const formatYen = (n: number) =>
  `${Math.round(n).toLocaleString("ja-JP")}円`;

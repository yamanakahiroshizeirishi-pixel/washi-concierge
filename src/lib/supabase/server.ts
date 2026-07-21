import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// サーバーコンポーネント / Route Handler 用クライアント。
// 認証していない一般利用では anon キー + RLS（公開商品のみ）で動作する。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // サーバーコンポーネントからの呼び出しでは set できない場合がある（無視してよい）
          }
        },
      },
    }
  );
}

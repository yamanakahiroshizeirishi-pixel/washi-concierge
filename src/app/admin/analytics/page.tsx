import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "分析" };

type LogRow = {
  extracted_conditions: { usage?: string } | null;
  recommended_product_ids: string[];
  could_not_answer: boolean;
  customer_question: string | null;
  created_at: string;
};

function countBar(count: number, max: number) {
  const width = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <span
      aria-hidden
      className="block h-2 rounded bg-primary/60"
      style={{ width: `${width}%` }}
    />
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [{ data: logRows }, { data: clickRows }, { data: products }] =
    await Promise.all([
      supabase
        .from("consultation_logs")
        .select(
          "extracted_conditions, recommended_product_ids, could_not_answer, customer_question, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("product_clicks").select("product_id"),
      supabase.from("products").select("id, name"),
    ]);

  const logs = (logRows ?? []) as LogRow[];
  const nameOf = new Map((products ?? []).map((p) => [p.id, p.name]));

  // 用途別相談件数
  const usageCounts = new Map<string, number>();
  for (const log of logs) {
    const usage = log.extracted_conditions?.usage || "（用途不明）";
    usageCounts.set(usage, (usageCounts.get(usage) ?? 0) + 1);
  }
  const usageRanking = [...usageCounts.entries()].sort((a, b) => b[1] - a[1]);

  // 商品別提案件数
  const recCounts = new Map<string, number>();
  for (const log of logs) {
    for (const id of log.recommended_product_ids ?? []) {
      recCounts.set(id, (recCounts.get(id) ?? 0) + 1);
    }
  }
  const recRanking = [...recCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 商品別クリック数
  const clickCounts = new Map<string, number>();
  for (const c of clickRows ?? []) {
    clickCounts.set(c.product_id, (clickCounts.get(c.product_id) ?? 0) + 1);
  }
  const clickRanking = [...clickCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // AIが回答できなかった相談
  const unanswered = logs.filter((l) => l.could_not_answer).slice(0, 20);

  const maxUsage = usageRanking[0]?.[1] ?? 0;
  const maxRec = recRanking[0]?.[1] ?? 0;
  const maxClick = clickRanking[0]?.[1] ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-semibold">分析（直近1,000件）</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">用途別の相談件数</CardTitle>
          </CardHeader>
          <CardContent>
            {usageRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">データがありません。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {usageRanking.map(([usage, count]) => (
                  <li key={usage}>
                    <div className="flex justify-between">
                      <span>{usage}</span>
                      <span className="text-muted-foreground">{count}件</span>
                    </div>
                    {countBar(count, maxUsage)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品別の提案件数（上位10件）</CardTitle>
          </CardHeader>
          <CardContent>
            {recRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">データがありません。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recRanking.map(([id, count]) => (
                  <li key={id}>
                    <div className="flex justify-between gap-3">
                      <span className="truncate">{nameOf.get(id) ?? "（削除済み商品）"}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {count}回
                      </span>
                    </div>
                    {countBar(count, maxRec)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              購入ページのクリック数（上位10件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clickRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                まだクリックがありません。
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {clickRanking.map(([id, count]) => (
                  <li key={id}>
                    <div className="flex justify-between gap-3">
                      <span className="truncate">{nameOf.get(id) ?? "（削除済み商品）"}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {count}回
                      </span>
                    </div>
                    {countBar(count, maxClick)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              AIが回答できなかった相談（最新20件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unanswered.length === 0 ? (
              <p className="text-sm text-muted-foreground">ありません。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {unanswered.map((log, i) => (
                  <li key={i} className="rounded-md border p-2">
                    <p className="line-clamp-2">{log.customer_question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("ja-JP")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

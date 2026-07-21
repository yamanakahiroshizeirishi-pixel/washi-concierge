"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ConsultationLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ScoreRow = {
  product_id: string;
  product_name: string;
  total: number;
  usage: number;
  size: number;
  budget: number;
  color: number;
  pattern: number;
  thickness: number;
  stock: number;
  reasons: string[];
};

const SOURCE_LABEL: Record<string, string> = {
  chat: "チャット",
  diagnosis: "かんたん診断",
  line: "LINE",
};

export function LogsClient() {
  const [logs, setLogs] = useState<ConsultationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) setError(`読み込みに失敗しました: ${error.message}`);
      setLogs((data ?? []) as ConsultationLog[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-xl font-semibold">AI相談履歴（直近200件）</h1>
      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">相談履歴はまだありません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>経路</TableHead>
                <TableHead>お客様の相談</TableHead>
                <TableHead>提案数</TableHead>
                <TableHead>詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(log.created_at).toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {SOURCE_LABEL[log.source] ?? log.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <span className="line-clamp-2 text-sm">
                      {log.customer_question}
                    </span>
                  </TableCell>
                  <TableCell>
                    {log.could_not_answer ? (
                      <Badge className="bg-destructive/10 text-destructive border-transparent">
                        回答不可
                      </Badge>
                    ) : (
                      `${log.recommended_product_ids.length}件`
                    )}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button variant="outline" size="sm">
                            開く
                          </Button>
                        }
                      />
                      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>相談の詳細</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 text-sm">
                          <section>
                            <h3 className="font-medium">お客様の相談</h3>
                            <p className="mt-1 whitespace-pre-wrap rounded-md bg-secondary/60 p-2">
                              {log.customer_question}
                            </p>
                          </section>
                          <section>
                            <h3 className="font-medium">AIの回答</h3>
                            <p className="mt-1 whitespace-pre-wrap rounded-md bg-secondary/60 p-2">
                              {log.ai_response}
                            </p>
                          </section>
                          <section>
                            <h3 className="font-medium">抽出された条件</h3>
                            <pre className="mt-1 overflow-x-auto rounded-md bg-secondary/60 p-2 text-xs">
                              {JSON.stringify(log.extracted_conditions, null, 2)}
                            </pre>
                          </section>
                          {Array.isArray(log.recommendation_scores) &&
                            log.recommendation_scores.length > 0 && (
                              <section>
                                <h3 className="font-medium">推薦点数と内訳</h3>
                                <div className="mt-1 space-y-2">
                                  {(log.recommendation_scores as ScoreRow[]).map(
                                    (s) => (
                                      <div
                                        key={s.product_id}
                                        className="rounded-md border p-2"
                                      >
                                        <p className="font-medium">
                                          {s.product_name}（合計 {s.total}点）
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          用途{s.usage} / サイズ{s.size} / 予算
                                          {s.budget} / 色{s.color} / 柄{s.pattern}{" "}
                                          / 厚さ{s.thickness} / 在庫{s.stock}
                                        </p>
                                        {s.reasons?.length > 0 && (
                                          <p className="mt-1 text-xs">
                                            {s.reasons.join("。")}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </section>
                            )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

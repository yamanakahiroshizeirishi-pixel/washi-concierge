"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RecommendCard } from "@/components/recommend-card";
import type { RecommendedItem } from "@/lib/types";
import type { Conditions } from "@/lib/conditions";
import { RotateCcw, SendHorizontal } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  items?: RecommendedItem[];
  logId?: string | null;
  isError?: boolean;
};

const STORAGE_KEY = "washi-chat-state";
const SESSION_KEY = "washi-session-id";

// 条件修正のクイック例（前回条件を引き継いで再検索される）
const REFINE_EXAMPLES = [
  "もう少し安いものがいい",
  "柄なしがよい",
  "もっと厚い和紙がいい",
  "赤ではなく青がよい",
];

function getSessionId(): string {
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function ChatClient() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  // ブラウザを閉じるまで相談履歴を保持（sessionStorage）
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.messages ?? []);
        setConditions(parsed.conditions ?? null);
      }
    } catch {
      // 保存データが壊れていても無視して新規開始
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages, conditions })
      );
    } catch {
      // 容量超過などは無視
    }
  }, [messages, conditions, restored]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;
      setLoading(true);
      setInput("");
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: getSessionId(),
            source: "chat",
            message,
            conditions,
            history,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "error");
        setConditions(data.conditions ?? null);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            items: data.items ?? [],
            logId: data.logId ?? null,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              e instanceof Error && e.message !== "error"
                ? e.message
                : "申し訳ございません。通信に失敗しました。時間をおいてもう一度お試しください。",
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [conditions, loading, messages]
  );

  // トップページからの ?q= を自動送信
  useEffect(() => {
    if (!restored || autoSentRef.current) return;
    const q = searchParams.get("q");
    if (q && messages.length === 0) {
      autoSentRef.current = true;
      send(q);
    }
  }, [restored, searchParams, messages.length, send]);

  const reset = () => {
    setMessages([]);
    setConditions(null);
    window.sessionStorage.removeItem(STORAGE_KEY);
  };

  const hasItems = messages.some((m) => (m.items?.length ?? 0) > 0);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-serif text-xl font-semibold">AIに相談する</h1>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw aria-hidden className="size-4" />
          最初から相談する
        </Button>
      </div>

      <div
        className="flex-1 space-y-4 rounded-lg border bg-card/50 p-4"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <p>
              ご希望の用途・ご予算・色などを、普段の言葉でお聞かせください。
            </p>
            <p className="mt-2 text-sm">
              例：「結婚祝いの包み紙を探しています。赤すぎない落ち着いた色で、予算は3,000円くらいです」
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="space-y-3">
            <div
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground"
                  : `mr-auto max-w-[95%] rounded-2xl rounded-bl-sm border px-4 py-3 ${m.isError ? "bg-destructive/10" : "bg-card"}`
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {m.content}
              </p>
            </div>
            {m.items && m.items.length > 0 && (
              <div className="space-y-3">
                {m.items.map((item, rank) => (
                  <RecommendCard
                    key={item.product.id}
                    item={item}
                    rank={rank + 1}
                    logId={m.logId ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <p className="text-sm text-muted-foreground">
            商品を確認しています…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {hasItems && (
        <div className="mt-3 flex flex-wrap gap-2">
          {REFINE_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => send(ex)}
              disabled={loading}
              className="rounded-full border bg-card px-3 py-1.5 text-xs hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          相談内容
        </label>
        <Textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="ご相談内容を入力してください"
          rows={2}
          className="min-h-12 resize-none bg-card text-base"
        />
        <Button
          type="submit"
          size="lg"
          disabled={loading || !input.trim()}
          className="h-12"
        >
          <SendHorizontal aria-hidden className="size-5" />
          送信
        </Button>
      </form>
    </div>
  );
}

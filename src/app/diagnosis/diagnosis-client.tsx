"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecommendCard } from "@/components/recommend-card";
import type { RecommendedItem } from "@/lib/types";
import { RotateCcw } from "lucide-react";

const USAGES = [
  "包装",
  "ギフト",
  "障子",
  "印刷",
  "書道",
  "絵画",
  "工作",
  "インテリア",
  "照明",
  "店舗装飾",
  "名刺",
  "招待状",
  "海外土産",
  "その他",
];

const COLORS = [
  "白",
  "生成り",
  "赤系",
  "青系",
  "緑系",
  "黄色系",
  "金・銀",
  "淡い色",
  "落ち着いた色",
  "鮮やかな色",
  "おまかせ",
];

const PATTERNS = [
  "無地",
  "花柄",
  "和柄",
  "幾何学柄",
  "季節柄",
  "金銀入り",
  "手すき模様",
  "おまかせ",
];

const BUDGETS = [
  { label: "1,000円未満", min: null, max: 999 },
  { label: "1,000～3,000円", min: 1000, max: 3000 },
  { label: "3,000～5,000円", min: 3000, max: 5000 },
  { label: "5,000～10,000円", min: 5000, max: 10000 },
  { label: "10,000円以上", min: 10000, max: null },
  { label: "指定なし", min: null, max: null },
];

const ENVIRONMENTS = [
  "屋内",
  "屋外",
  "水回り",
  "高温になる場所",
  "長期間使用",
  "短期間使用",
  "指定なし",
];

type Result = {
  message: string;
  items: RecommendedItem[];
  logId: string | null;
};

function getSessionId(): string {
  let id = window.sessionStorage.getItem("washi-session-id");
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem("washi-session-id", id);
  }
  return id;
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2.5 text-sm transition-colors ${
        selected
          ? "border-transparent bg-primary text-primary-foreground"
          : "bg-card hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

export function DiagnosisClient() {
  const [usage, setUsage] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [budgetIndex, setBudgetIndex] = useState<number | null>(null);
  const [sizeW, setSizeW] = useState("");
  const [sizeH, setSizeH] = useState("");
  const [sizeD, setSizeD] = useState(""); // 包装時の高さ(箱)
  const [quantity, setQuantity] = useState("");
  const [environment, setEnvironment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    value: string
  ) => {
    if (value === "おまかせ") {
      setList([]);
      return;
    }
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  };

  const isWrap = usage === "包装" || usage === "ギフト" || usage === "海外土産";
  const isShoji = usage === "障子";
  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const submit = async () => {
    if (!usage) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const budget = budgetIndex !== null ? BUDGETS[budgetIndex] : null;
    const qty = num(quantity);
    const w = num(sizeW);
    const h = num(sizeH);
    const d = num(sizeD);

    const conditions: Record<string, unknown> = {
      usage: usage === "その他" ? "" : usage,
      budget_min: budget?.min ?? null,
      budget_max: budget?.max ?? null,
      preferred_colors: colors,
      preferred_patterns: patterns,
      usage_environment:
        environment && environment !== "指定なし" ? environment : "",
      water_resistance_required:
        environment === "屋外" || environment === "水回り",
      heat_resistance_required: environment === "高温になる場所",
    };
    if (isShoji) {
      conditions.shoji_width_mm = w ? w * 10 : null;
      conditions.shoji_height_mm = h ? h * 10 : null;
      conditions.shoji_count = qty;
    } else if (isWrap && d) {
      conditions.box_length_mm = h ? h * 10 : null;
      conditions.box_width_mm = w ? w * 10 : null;
      conditions.box_height_mm = d * 10;
      conditions.item_count = qty;
    } else {
      conditions.required_width_mm = w ? w * 10 : null;
      conditions.required_height_mm = h ? h * 10 : null;
      conditions.quantity = qty;
    }

    const parts = [
      `用途は${usage}`,
      colors.length > 0 ? `色は${colors.join("・")}` : null,
      patterns.length > 0 ? `柄は${patterns.join("・")}` : null,
      budget && (budget.min || budget.max) ? `予算は${budget.label}` : null,
      environment && environment !== "指定なし"
        ? `使用環境は${environment}`
        : null,
    ].filter(Boolean);
    const message = `【かんたん診断】${parts.join("、")}で和紙を探しています。`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          source: "diagnosis",
          message,
          conditions,
          history: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "error");
      setResult({
        message: data.message,
        items: data.items ?? [],
        logId: data.logId ?? null,
      });
      // チャット画面に引き継げるよう保存
      try {
        window.sessionStorage.setItem(
          "washi-chat-state",
          JSON.stringify({
            messages: [
              { role: "user", content: message },
              {
                role: "assistant",
                content: data.message,
                items: data.items ?? [],
                logId: data.logId ?? null,
              },
            ],
            conditions: data.conditions ?? null,
          })
        );
      } catch {
        // 保存失敗は無視
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message !== "error"
          ? e.message
          : "通信に失敗しました。時間をおいてもう一度お試しください。"
      );
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {result.message}
          </p>
        </div>
        {result.items.map((item, i) => (
          <RecommendCard
            key={item.product.id}
            item={item}
            rank={i + 1}
            logId={result.logId}
          />
        ))}
        <div className="flex flex-wrap gap-3">
          <Button render={<a href="/chat" />}>
            チャットで続けて相談する
          </Button>
          <Button variant="outline" onClick={() => setResult(null)}>
            <RotateCcw aria-hidden className="size-4" />
            条件を変えて診断し直す
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="mb-3 font-medium">
          1. 用途 <span className="text-destructive">*</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {USAGES.map((u) => (
            <Chip key={u} selected={usage === u} onClick={() => setUsage(u)}>
              {u}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">2. お好みの色（複数選択可）</h2>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <Chip
              key={c}
              selected={c === "おまかせ" ? colors.length === 0 : colors.includes(c)}
              onClick={() => toggle(colors, setColors, c)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">3. お好みの柄（複数選択可）</h2>
        <div className="flex flex-wrap gap-2">
          {PATTERNS.map((p) => (
            <Chip
              key={p}
              selected={
                p === "おまかせ" ? patterns.length === 0 : patterns.includes(p)
              }
              onClick={() => toggle(patterns, setPatterns, p)}
            >
              {p}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">4. ご予算</h2>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b, i) => (
            <Chip
              key={b.label}
              selected={budgetIndex === i}
              onClick={() => setBudgetIndex(i)}
            >
              {b.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">
          5. 必要サイズ（cm・分かる範囲で）
        </h2>
        <div className="grid max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="size-w">
              {isShoji ? "障子の幅" : isWrap ? "箱の横" : "幅"}
            </Label>
            <Input
              id="size-w"
              inputMode="decimal"
              value={sizeW}
              onChange={(e) => setSizeW(e.target.value)}
              placeholder="cm"
              className="mt-1 bg-card"
            />
          </div>
          <div>
            <Label htmlFor="size-h">
              {isShoji ? "障子の高さ" : isWrap ? "箱の縦" : "高さ"}
            </Label>
            <Input
              id="size-h"
              inputMode="decimal"
              value={sizeH}
              onChange={(e) => setSizeH(e.target.value)}
              placeholder="cm"
              className="mt-1 bg-card"
            />
          </div>
          {isWrap && (
            <div>
              <Label htmlFor="size-d">箱の高さ</Label>
              <Input
                id="size-d"
                inputMode="decimal"
                value={sizeD}
                onChange={(e) => setSizeD(e.target.value)}
                placeholder="cm"
                className="mt-1 bg-card"
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">
          6. {isShoji ? "障子の枚数" : isWrap ? "包装する個数" : "必要枚数"}
        </h2>
        <Input
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={isShoji ? "例：4" : "例：2"}
          className="max-w-40 bg-card"
          aria-label="数量"
        />
      </section>

      <section>
        <h2 className="mb-3 font-medium">7. 使用環境</h2>
        <div className="flex flex-wrap gap-2">
          {ENVIRONMENTS.map((env) => (
            <Chip
              key={env}
              selected={environment === env}
              onClick={() => setEnvironment(env)}
            >
              {env}
            </Chip>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm">{error}</p>
      )}

      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={!usage || loading}
        onClick={submit}
      >
        {loading ? "商品を確認しています…" : "この条件で診断する"}
      </Button>
    </div>
  );
}

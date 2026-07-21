"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calcWrapping, calcShoji, calcWall } from "@/lib/calc";
import type { QuantityEstimate } from "@/lib/types";

function NumField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "cm"}
        className="mt-1 bg-card"
      />
    </div>
  );
}

function ResultBox({ result }: { result: QuantityEstimate | null }) {
  if (!result) return null;
  return (
    <div className="mt-4 rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold">
        必要枚数の目安: {result.sheets}枚
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{result.explanation}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        ※ あくまで目安です。柄合わせが必要な場合や、初めての作業では少し多めのご用意をおすすめします。
      </p>
    </div>
  );
}

const cm = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n * 10 : null;
};
const int = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function CalculatorClient() {
  // 包装
  const [wL, setWL] = useState("30");
  const [wW, setWW] = useState("20");
  const [wH, setWH] = useState("10");
  const [wCount, setWCount] = useState("1");
  const [wSheetW, setWSheetW] = useState("64");
  const [wSheetH, setWSheetH] = useState("94");
  const [wResult, setWResult] = useState<QuantityEstimate | null>(null);

  // 障子
  const [sW, setSW] = useState("90");
  const [sH, setSH] = useState("180");
  const [sCount, setSCount] = useState("4");
  const [sSheetW, setSSheetW] = useState("94");
  const [sSheetH, setSSheetH] = useState("215");
  const [sResult, setSResult] = useState<QuantityEstimate | null>(null);

  // 壁面
  const [kW, setKW] = useState("180");
  const [kH, setKH] = useState("240");
  const [kCount, setKCount] = useState("1");
  const [kSheetW, setKSheetW] = useState("64");
  const [kSheetH, setKSheetH] = useState("94");
  const [kResult, setKResult] = useState<QuantityEstimate | null>(null);

  return (
    <Tabs defaultValue="wrap" className="mt-6">
      <TabsList className="w-full">
        <TabsTrigger value="wrap" className="flex-1">
          包装紙
        </TabsTrigger>
        <TabsTrigger value="shoji" className="flex-1">
          障子紙
        </TabsTrigger>
        <TabsTrigger value="wall" className="flex-1">
          壁面・内装
        </TabsTrigger>
      </TabsList>

      <TabsContent value="wrap" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField id="w-l" label="箱の縦（奥行）" value={wL} onChange={setWL} />
          <NumField id="w-w" label="箱の横" value={wW} onChange={setWW} />
          <NumField id="w-h" label="箱の高さ" value={wH} onChange={setWH} />
          <NumField
            id="w-count"
            label="包装する個数"
            value={wCount}
            onChange={setWCount}
            placeholder="個"
          />
          <NumField
            id="w-sheet-w"
            label="和紙1枚の幅"
            value={wSheetW}
            onChange={setWSheetW}
          />
          <NumField
            id="w-sheet-h"
            label="和紙1枚の長さ"
            value={wSheetH}
            onChange={setWSheetH}
          />
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            const l = cm(wL), w = cm(wW), h = cm(wH);
            const c = int(wCount), sw = cm(wSheetW), sh = cm(wSheetH);
            if (l && w && h && c && sw && sh)
              setWResult(calcWrapping(l, w, h, c, sw, sh));
          }}
        >
          計算する
        </Button>
        <ResultBox result={wResult} />
        <p className="text-xs text-muted-foreground">
          計算方法: 紙の幅は「箱の横と高さの合計×2＋重なり3cm」、奥行方向は「箱の縦＋高さ×1.5＋余白2cm」で見積り、失敗分の予備10%を加えています。
        </p>
      </TabsContent>

      <TabsContent value="shoji" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField id="s-w" label="障子1枚の幅" value={sW} onChange={setSW} />
          <NumField id="s-h" label="障子1枚の高さ" value={sH} onChange={setSH} />
          <NumField
            id="s-count"
            label="障子の枚数"
            value={sCount}
            onChange={setSCount}
            placeholder="枚"
          />
          <NumField
            id="s-sheet-w"
            label="和紙1枚の幅"
            value={sSheetW}
            onChange={setSSheetW}
          />
          <NumField
            id="s-sheet-h"
            label="和紙1枚の長さ"
            value={sSheetH}
            onChange={setSSheetH}
          />
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            const w = cm(sW), h = cm(sH), c = int(sCount);
            const sw = cm(sSheetW), sh = cm(sSheetH);
            if (w && h && c && sw && sh) setSResult(calcShoji(w, h, c, sw, sh));
          }}
        >
          計算する
        </Button>
        <ResultBox result={sResult} />
        <p className="text-xs text-muted-foreground">
          計算方法: 障子1枚の寸法に貼りしろ各4cmを加えた面積を覆える枚数を求め、失敗分の予備10%を加えています。
        </p>
      </TabsContent>

      <TabsContent value="wall" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField id="k-w" label="面の幅" value={kW} onChange={setKW} />
          <NumField id="k-h" label="面の高さ" value={kH} onChange={setKH} />
          <NumField
            id="k-count"
            label="面数"
            value={kCount}
            onChange={setKCount}
            placeholder="面"
          />
          <NumField
            id="k-sheet-w"
            label="和紙1枚の幅"
            value={kSheetW}
            onChange={setKSheetW}
          />
          <NumField
            id="k-sheet-h"
            label="和紙1枚の長さ"
            value={kSheetH}
            onChange={setKSheetH}
          />
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            const w = cm(kW), h = cm(kH), c = int(kCount);
            const sw = cm(kSheetW), sh = cm(kSheetH);
            if (w && h && c && sw && sh) setKResult(calcWall(w, h, c, sw, sh));
          }}
        >
          計算する
        </Button>
        <ResultBox result={kResult} />
        <p className="text-xs text-muted-foreground">
          計算方法: 面を覆うのに必要な枚数を縦横の割り付けで求め、施工ロス12%を加えています。
        </p>
      </TabsContent>
    </Tabs>
  );
}

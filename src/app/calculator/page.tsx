import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CalculatorClient } from "./calculator-client";

export const metadata = { title: "必要枚数の計算" };

export default function CalculatorPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="font-serif text-xl font-semibold">必要枚数の計算</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          用途と寸法を入力すると、失敗分の予備を含めた必要枚数の目安を計算します。
        </p>
        <CalculatorClient />
      </main>
      <SiteFooter />
    </>
  );
}

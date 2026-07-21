import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DiagnosisClient } from "./diagnosis-client";

export const metadata = { title: "かんたん診断" };

export default function DiagnosisPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="font-serif text-xl font-semibold">
          ボタンで選ぶ かんたん診断
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          いくつかの質問に答えるだけで、おすすめの和紙をご提案します。分からない項目は「おまかせ」のままで大丈夫です。
        </p>
        <DiagnosisClient />
      </main>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSettings } from "@/lib/settings";
import { MessageCircle, ListChecks, Calculator } from "lucide-react";

const EXAMPLES = [
  "贈り物を包みたい",
  "障子を張り替えたい",
  "プリンターで印刷したい",
  "和紙で工作したい",
  "海外へのお土産を探したい",
  "店舗の内装に使いたい",
];

const USAGE_LINKS = [
  "包装",
  "ギフト",
  "障子",
  "印刷",
  "書道",
  "絵画",
  "工作",
  "インテリア",
  "照明",
  "海外土産",
];

export default async function HomePage() {
  const settings = await getSettings();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:pt-20">
          <h1 className="font-serif text-3xl font-semibold leading-relaxed sm:text-4xl">
            どのような和紙を
            <br className="sm:hidden" />
            お探しですか？
          </h1>
          <p className="mt-4 text-muted-foreground">
            {settings.store_name}
            のAI販売員が、用途・ご予算・お好みに合わせて商品をご提案します。
          </p>

          {/* チャットへの入口 */}
          <form action="/chat" className="mx-auto mt-8 flex max-w-xl gap-2">
            <label htmlFor="home-q" className="sr-only">
              ご相談内容
            </label>
            <Input
              id="home-q"
              name="q"
              placeholder="例：結婚祝いの包み紙を探しています。予算は3,000円くらいです"
              className="h-12 bg-card text-base"
            />
            <Button type="submit" size="lg" className="h-12">
              <MessageCircle aria-hidden className="size-5" />
              相談する
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <Link
                key={ex}
                href={`/chat?q=${encodeURIComponent(ex)}`}
                className="rounded-full border bg-card px-4 py-2 text-sm hover:bg-secondary transition-colors"
              >
                {ex}
              </Link>
            ))}
          </div>

          <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
            <Button
              render={<Link href="/diagnosis" />}
              variant="outline"
              size="lg"
              className="h-14 text-base"
            >
              <ListChecks aria-hidden className="size-5" />
              ボタンで選ぶ かんたん診断
            </Button>
            <Button
              render={<Link href="/calculator" />}
              variant="outline"
              size="lg"
              className="h-14 text-base"
            >
              <Calculator aria-hidden className="size-5" />
              必要枚数の計算
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16">
          <h2 className="mb-4 text-center font-serif text-lg font-semibold">
            用途からさがす
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {USAGE_LINKS.map((u) => (
              <Link
                key={u}
                href={`/products?usage=${encodeURIComponent(u)}`}
                className="rounded-md border bg-card px-5 py-3 text-sm font-medium hover:bg-secondary transition-colors"
              >
                {u}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

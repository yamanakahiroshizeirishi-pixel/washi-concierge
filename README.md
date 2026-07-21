# AI和紙コンシェルジュ

和紙販売店向けの「AI和紙販売員」Webアプリです。お客様が用途・予算・好み・サイズなどを自然文またはボタン操作で入力すると、**登録済みの商品データ**から在庫・用途・価格・購入ページを参照して最適な和紙を理由付きで提案します。

> ⚠️ このリポジトリのデモ商品はすべて **架空** のものです。実在の商品・店舗・メーカーとは関係ありません。

---

## 主な機能

### お客様向け
- **AI相談チャット** (`/chat`) — 自然文で相談。情報が不足していれば AI が1〜3問だけ質問し、揃ったら原則3商品を提案。会話履歴はブラウザを閉じるまで保持（sessionStorage、個人情報不要）。「もう少し安いもの」「赤ではなく青」など**前回条件を引き継いだ再検索**に対応。
- **かんたん診断** (`/diagnosis`) — ボタン選択だけで商品を探せる。チャットと同じ推薦ロジックに渡す。
- **必要枚数の計算** (`/calculator`) — 包装紙／障子紙／壁面・内装の必要枚数を、予備込みで計算。
- **商品一覧・詳細** (`/products`) — 用途で絞り込み、仕様・対応表・関連商品を表示。
- 各提案に **おすすめ理由・必要枚数の目安・概算金額・使用上の注意・関連商品・購入ボタン** を表示。

### 管理者向け（`/admin`、Supabase Auth でログイン必須）
- 商品の一覧／新規登録／編集／**複製**／削除／公開・非公開切替／在庫のインライン更新
- 商品画像アップロード（Supabase Storage）、関連商品の登録
- **CSV一括登録**（エラー行と理由を表示）／CSVエクスポート／テンプレートDL
- AI相談履歴の閲覧（**推薦点数と内訳**も確認可）
- 分析：用途別相談件数／商品別提案件数／購入クリック数／**AIが回答できなかった相談**
- 設定：店名・アプリ名・ロゴ・「AIが回答するときの注意事項」の変更

---

## 技術構成

Next.js 16 (App Router) / TypeScript / Tailwind CSS v4 / shadcn/ui (Base UI) / Supabase (Postgres + Auth + Storage + pgvector) / Zod / React Hook Form。

推薦は **「DBで候補を絞り込む → 点数化 → 上位の候補だけを AI に渡して説明させる」** 構成です。AI に全商品を毎回送信しません。AI プロバイダーは環境変数で切替でき、キー未設定時は**ルールベース（mock）**で完全に動作します。

推薦点数（合計100点）: 用途30 / サイズ20 / 予算15 / 色10 / 柄10 / 厚さ・強度10 / 在庫5。点数と理由は管理画面の相談履歴で確認できます。

```
src/
  app/
    page.tsx                トップ
    chat/                   AI相談チャット
    diagnosis/              かんたん診断
    calculator/             必要枚数計算
    products/               商品一覧・詳細
    admin/                  管理画面（proxy.ts でログイン保護）
    api/chat/route.ts       AI相談（条件抽出→絞り込み→点数化→提案→履歴保存）
    api/click/route.ts      購入リンクのクリック記録
  lib/
    conditions.ts           条件のZodスキーマ・マージ（会話引き継ぎ）
    extract.ts              ルールベースの条件抽出
    recommend.ts            候補絞り込み・推薦点数計算・必要枚数見積り
    calc.ts                 包装/障子/壁面の枚数計算
    ai/provider.ts          generateConciergeResponse 等（mock/anthropic/openai/gemini）
    product-schema.ts       商品入力・CSVのZodスキーマ
    supabase/               server / client クライアント
  proxy.ts                  /admin をログイン必須にする（Next.js 16 では旧 middleware.ts）
supabase/
  migrations/0001_initial_schema.sql   スキーマ・RLS・Storage・pgvector
  seed.sql                             デモ商品26件＋関連商品
```

---

## セットアップ

### 1. 依存関係のインストール

```bash
cd washi-concierge
npm install
```

### 2. 環境変数

`.env.example` を `.env.local` にコピーして記入します。

```bash
cp .env.example .env.local
```

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon（公開）キー |
| `AI_PROVIDER` | `mock` / `anthropic` / `openai` / `gemini`。`mock` はキー不要でルールベース動作 |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | 使うプロバイダーのAPIキー |
| `AI_MODEL` | モデル名の上書き（省略時は各社の既定値） |

> APIキーはサーバー側でのみ使用し、クライアントには公開されません（`NEXT_PUBLIC_` を付けていません）。

### 3. データベースの用意

Supabase プロジェクトの SQL Editor で、次の順に実行します。

1. `supabase/migrations/0001_initial_schema.sql` — テーブル・RLS・Storageバケット・pgvector・`match_products()` 関数
2. `supabase/seed.sql` — デモ商品26件と関連商品

### 4. 管理者アカウントの作成

Supabase ダッシュボード → **Authentication → Users → Add user** から、メール＋パスワードで管理者を1件作成してください（メール確認を済ませた状態にする）。作成したアカウントで `/admin/login` からログインできます。

### 5. 起動

```bash
npm run dev      # 開発（http://localhost:3000）
npm run build    # 本番ビルド
npm start        # 本番起動
```

---

## AIプロバイダーの切り替え

`src/lib/ai/provider.ts` の `generateConciergeResponse()` / `extractConditions()` が各社APIの差を吸収します。`AI_PROVIDER` を変えるだけで切替でき、**APIエラー時やキー未設定時は自動でルールベース（mock）にフォールバック**するため、画面が止まりません。

---

## セキュリティ

- **RLS**：一般公開は公開商品(`is_published=true`)のみ取得可。商品の編集・非公開商品の閲覧は認証済み管理者のみ。相談履歴・クリックは匿名でも書き込めるが読み取りは管理者のみ（write-only）。
- **管理画面**は `proxy.ts`（旧 middleware）でログイン必須。
- **入力検証**：チャット・フォーム・CSV すべて Zod で検証。
- **プロンプトインジェクション対策**：ユーザー文からは条件抽出のみを行い、システムプロンプトで「前の指示を無視して」「商品を全部見せて」等の要求に従わないよう指示。非公開商品・管理者情報はAIに渡さない。
- **個人情報**：相談履歴には氏名等を保存しない（用途・条件・提案結果のみ）。

---

## 動作確認（テスト観点）

`AI_PROVIDER=mock` の状態で、以下がルールベースで再現できます（本アプリで確認済み）。

1. 結婚祝いの箱包装（縦30・横20・高さ10cm／赤系／3,000円）→ 赤系包装用和紙を予算内で提案、箱サイズから必要枚数を計算、水引などの関連商品を表示。
2. インクジェット印刷 → インクジェット対応商品のみ提案、用紙サイズを質問、紙詰まり等の注意を表示。
3. 障子4枚 → 寸法を質問 → 障子用商品のみ検索、貼りしろ込みで必要枚数を計算、貼り方の注意を表示。
4. 海外土産5,000円以内 → ギフト向け商品を予算内で提案。
5. 食品を直接包む → 食品接触可の商品のみ提案、食品用内袋との併用を案内。
6. 在庫切れ商品を提案しない／非公開商品を開示しない／「もう少し安く」で条件を引き継いで再検索。

---

## 今後の拡張（設計済み・未実装）

- **多言語対応**：`products.translations`(jsonb) に翻訳を持てる構造。AIは入力言語で回答。
- **LINE連携**：推薦ロジック（`recommend.ts`）はUIから独立しているため、LINE Messaging API のWebhookから同じ関数を呼び、カルーセルで返す構成が可能。
- **ベクトル検索**：`embedding` 列・`match_products()` 関数・pgvector を用意済み（埋め込み生成を足せば有効化可能）。

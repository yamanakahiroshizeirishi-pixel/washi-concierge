-- AI和紙コンシェルジュ 初期スキーマ
-- （Supabaseプロジェクトに適用済み。新しい環境ではSQLエディタでこのファイルを実行してください）
create extension if not exists vector;

-- 商品テーブル
create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  name text not null,
  short_description text,
  detailed_description text,
  category text not null,
  usage_tags text[] not null default '{}',
  color_tags text[] not null default '{}',
  pattern_tags text[] not null default '{}',
  material text,
  production_method text,
  origin text,
  manufacturer text,
  width_mm integer,
  height_mm integer,
  thickness text,
  weight_gsm numeric,
  strength_level integer check (strength_level between 1 and 5),
  transparency_level integer check (transparency_level between 1 and 5),
  texture text,
  inkjet_compatible boolean not null default false,
  laser_printer_compatible boolean not null default false,
  calligraphy_compatible boolean not null default false,
  food_contact_compatible boolean not null default false,
  water_resistant boolean not null default false,
  heat_resistant boolean not null default false,
  indoor_compatible boolean not null default true,
  outdoor_compatible boolean not null default false,
  price numeric not null,
  tax_included_price numeric not null,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 5,
  minimum_order_quantity integer not null default 1,
  image_urls text[] not null default '{}',
  purchase_url text,
  caution_notes text,
  recommended_uses text[] not null default '{}',
  prohibited_uses text[] not null default '{}',
  is_published boolean not null default true,
  translations jsonb not null default '{}'::jsonb, -- 多言語対応用 {"en": {"name": ..., "short_description": ..., "caution_notes": ...}}
  embedding vector(1536), -- ベクトル検索用（任意）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category);
create index products_price_idx on public.products (tax_included_price);
create index products_published_idx on public.products (is_published);
create index products_usage_tags_idx on public.products using gin (usage_tags);
create index products_color_tags_idx on public.products using gin (color_tags);
create index products_pattern_tags_idx on public.products using gin (pattern_tags);

-- 関連商品テーブル
create table public.related_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  related_product_id uuid not null references public.products(id) on delete cascade,
  relation_type text not null,
  display_order integer not null default 0,
  unique (product_id, related_product_id)
);

create index related_products_product_idx on public.related_products (product_id);

-- 相談履歴テーブル（個人情報は保存しない）
create table public.consultation_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  source text not null default 'chat', -- chat / diagnosis / line
  customer_question text,
  extracted_conditions jsonb,
  ai_response text,
  recommended_product_ids uuid[] not null default '{}',
  recommendation_scores jsonb, -- 管理画面用: 各商品の点数と内訳
  could_not_answer boolean not null default false,
  clicked_product_id uuid,
  created_at timestamptz not null default now()
);

create index consultation_logs_created_idx on public.consultation_logs (created_at desc);
create index consultation_logs_session_idx on public.consultation_logs (session_id);

-- 購入リンククリック記録
create table public.product_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  consultation_log_id uuid references public.consultation_logs(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);

create index product_clicks_product_idx on public.product_clicks (product_id);

-- アプリ設定（1行のみ）
create table public.app_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default '和紙の店',
  app_name text not null default 'AI和紙コンシェルジュ',
  logo_url text,
  ai_notes text, -- AIが回答するときの注意事項（システムプロンプトに追加）
  updated_at timestamptz not null default now()
);

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ============ Row Level Security ============
alter table public.products enable row level security;
alter table public.related_products enable row level security;
alter table public.consultation_logs enable row level security;
alter table public.product_clicks enable row level security;
alter table public.app_settings enable row level security;

-- 商品: 一般公開は公開商品のみ / 管理者(認証済み)は全操作
create policy "public_read_published_products" on public.products
  for select using (is_published = true);
create policy "admin_all_products" on public.products
  for all to authenticated using (true) with check (true);

-- 関連商品: 公開商品に紐づくもののみ一般公開
create policy "public_read_related" on public.related_products
  for select using (
    exists (select 1 from public.products p where p.id = related_product_id and p.is_published)
  );
create policy "admin_all_related" on public.related_products
  for all to authenticated using (true) with check (true);

-- 相談履歴: 匿名は書き込みのみ可（読み取り不可）、管理者は閲覧可
create policy "anon_insert_logs" on public.consultation_logs
  for insert to anon, authenticated with check (true);
create policy "admin_read_logs" on public.consultation_logs
  for select to authenticated using (true);

-- クリック記録: 匿名は書き込みのみ可、管理者は閲覧可
create policy "anon_insert_clicks" on public.product_clicks
  for insert to anon, authenticated with check (true);
create policy "admin_read_clicks" on public.product_clicks
  for select to authenticated using (true);

-- アプリ設定: 誰でも閲覧可、管理者のみ変更可
create policy "public_read_settings" on public.app_settings
  for select using (true);
create policy "admin_write_settings" on public.app_settings
  for all to authenticated using (true) with check (true);

-- ============ ベクトル検索関数（RLS適用・公開商品のみ） ============
create or replace function public.match_products(
  query_embedding vector(1536),
  match_count integer default 5
) returns setof public.products
language sql stable security invoker as $$
  select * from public.products
  where is_published = true and embedding is not null
  order by embedding <=> query_embedding
  limit match_count
$$;

-- ============ 商品画像用ストレージ ============
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "admin_upload_product_images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');
create policy "admin_update_product_images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');
create policy "admin_delete_product_images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- 初期設定行
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

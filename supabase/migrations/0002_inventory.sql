-- 在庫管理・発注管理
-- 月次の在庫台帳（繰越/入荷/出荷/返品/廃棄/期末棚卸）と、発注書の取り込み・繰り越し判断を扱う

alter table public.app_settings
  add column if not exists fiscal_year_start_month integer not null default 10
    check (fiscal_year_start_month between 1 and 12);

-- 出荷先・仕入先などのチャンネル（支店・卸先・EC・社内消化など）
create table public.inventory_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel_type text not null default 'external'
    check (channel_type in ('external', 'internal')), -- external: 卸先/支店/ECなど, internal: テスター・見本・広告など社内消化
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 在庫管理する商品（アプリ商品とは別に、仕入価格ベースで在庫を追う品目）
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  supplier_name text, -- 仕入先
  purchase_price numeric not null default 0, -- 仕入価格(税抜/個)
  wholesale_price numeric, -- 卸価格の目安
  low_stock_threshold integer not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_name_idx on public.inventory_items (name);
create index inventory_items_active_idx on public.inventory_items (is_active);

-- 入出庫の履歴（積み上げ式の台帳。月次サマリはここから計算する）
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  channel_id uuid references public.inventory_channels(id) on delete set null, -- 出荷(shipment)のときのみ使用
  movement_type text not null
    check (movement_type in (
      'incoming',        -- 入荷
      'shipment',        -- 出荷（チャンネル別）
      'return_in',       -- 返品戻り分
      'return_disposal', -- 返品分から処分
      'return_tester',   -- 返品からテスターに使用
      'disposal'         -- 商品を直接廃棄（返品を経由しない廃棄）
    )),
  quantity integer not null check (quantity >= 0),
  occurred_on date not null default current_date,
  note text,
  purchase_order_line_id uuid, -- 発注のライン消化で作られた出荷の場合に紐づける
  created_at timestamptz not null default now()
);

create index inventory_movements_item_date_idx on public.inventory_movements (item_id, occurred_on);
create index inventory_movements_type_idx on public.inventory_movements (movement_type);
create index inventory_movements_po_line_idx on public.inventory_movements (purchase_order_line_id);

-- 発注書（取引先・支店から届く発注の単位）
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text,
  channel_id uuid references public.inventory_channels(id) on delete set null,
  order_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'closed')),
  source_filename text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_channel_idx on public.purchase_orders (channel_id);
create index purchase_orders_date_idx on public.purchase_orders (order_date desc);

-- 発注書の明細行
create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null,
  raw_item_name text not null, -- 取り込み時点の商品名（未マッチの場合の手がかりとして保持）
  ordered_qty integer not null check (ordered_qty >= 0),
  fulfilled_qty integer not null default 0 check (fulfilled_qty >= 0),
  carried_over_qty integer not null default 0 check (carried_over_qty >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'partial', 'carried_over')),
  target_month date, -- 繰り越し先の月（その月の1日）。在庫が足りず来月にまわす場合に設定
  decision_note text,
  decided_at timestamptz,
  shipment_movement_id uuid references public.inventory_movements(id) on delete set null,
  created_at timestamptz not null default now()
);

create index purchase_order_lines_order_idx on public.purchase_order_lines (purchase_order_id);
create index purchase_order_lines_item_idx on public.purchase_order_lines (item_id);
create index purchase_order_lines_status_idx on public.purchase_order_lines (status);
create index purchase_order_lines_target_month_idx on public.purchase_order_lines (target_month);

alter table public.inventory_movements
  add constraint inventory_movements_po_line_fk
  foreign key (purchase_order_line_id) references public.purchase_order_lines(id) on delete set null;

create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger purchase_orders_set_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- ============ Row Level Security ============
-- すべて社内の在庫・発注データのため、一般公開はせず管理者(認証済み)のみが読み書きできる
alter table public.inventory_channels enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

create policy "admin_all_inventory_channels" on public.inventory_channels
  for all to authenticated using (true) with check (true);
create policy "admin_all_inventory_items" on public.inventory_items
  for all to authenticated using (true) with check (true);
create policy "admin_all_inventory_movements" on public.inventory_movements
  for all to authenticated using (true) with check (true);
create policy "admin_all_purchase_orders" on public.purchase_orders
  for all to authenticated using (true) with check (true);
create policy "admin_all_purchase_order_lines" on public.purchase_order_lines
  for all to authenticated using (true) with check (true);

-- 初期チャンネル例（必要に応じて管理画面から編集・追加してください）
insert into public.inventory_channels (name, channel_type, display_order) values
  ('直営店', 'external', 1),
  ('オンラインショップ', 'external', 2),
  ('卸先', 'external', 3),
  ('テスター・商品見本・広告販促', 'internal', 90),
  ('その他', 'external', 99)
on conflict (name) do nothing;

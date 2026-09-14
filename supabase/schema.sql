-- ============================================================
-- SỔ TAY DÙNG CHUNG CHO CẢ GIA ĐÌNH — KHÔNG CẦN TÀI KHOẢN
-- Chạy toàn bộ file này trong Supabase: SQL Editor -> New query -> Run
-- Chạy lại nhiều lần vẫn an toàn.
--
-- ⚠️ Ai có link web đều xem và sửa được. Đừng chia sẻ link công khai,
--    và nhớ thỉnh thoảng bấm "Xuất" sao lưu trong trang Cài đặt.
-- ============================================================

-- Gỡ luật bảo mật theo từng tài khoản của bản cũ (nếu có)
drop policy if exists "read categories" on public.categories;
drop policy if exists "write categories" on public.categories;
drop policy if exists "read recipes" on public.recipes;
drop policy if exists "write recipes" on public.recipes;
drop policy if exists "own categories" on public.categories;
drop policy if exists "own recipes" on public.recipes;
drop policy if exists "own cook_logs" on public.cook_logs;
drop policy if exists "own collections" on public.collections;
drop policy if exists "own shopping_items" on public.shopping_items;

-- ---------------- Danh mục ----------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '🍽️',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------- Công thức ----------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  prep_time int,
  cook_time int,
  servings int default 2,
  difficulty text default 'easy',
  ingredients jsonb not null default '[]',  -- [{ id, type, amount, unit, name }]
  steps jsonb not null default '[]',        -- [{ id, text, image_url }]
  notes text default '',
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes add column if not exists rating int not null default 0;
alter table public.recipes add column if not exists share_id uuid unique;
alter table public.recipes add column if not exists deleted_at timestamptz;

-- ---------------- Nhật ký nấu ----------------
create table if not exists public.cook_logs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cooked_at timestamptz not null default now(),
  note text not null default ''
);

-- ---------------- Bộ sưu tập ----------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '📁',
  recipe_ids uuid[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------- Danh sách đi chợ ----------------
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount text not null default '',
  unit text not null default '',
  checked boolean not null default false,
  recipe_title text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------- Cài đặt chung của cả nhà ----------------
-- id = 'pantry': danh sách gia vị có sẵn trong bếp
create table if not exists public.settings (
  id text primary key,
  value jsonb not null default 'null',
  updated_at timestamptz not null default now()
);

-- ---------------- Sổ tiền chợ ----------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  shopping_item_id uuid,                     -- món trong danh sách đi chợ (nếu ghi giá lúc tick)
  name text not null,
  amount text not null default '',
  unit text not null default '',
  price bigint not null default 0,           -- VNĐ
  recipe_title text not null default '',
  note text not null default '',
  bought_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists purchases_bought_idx on public.purchases(bought_at);

-- Bản cũ có cột user_id (dữ liệu theo tài khoản) -> không dùng nữa
alter table public.categories drop column if exists user_id;
alter table public.recipes drop column if exists user_id;
alter table public.cook_logs drop column if exists user_id;
alter table public.collections drop column if exists user_id;
alter table public.shopping_items drop column if exists user_id;

create index if not exists recipes_category_idx on public.recipes(category_id);
create index if not exists cook_logs_recipe_idx on public.cook_logs(recipe_id);

-- Tự cập nhật updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Quyền truy cập: ai mở web cũng xem & sửa được (không cần đăng nhập)
-- ------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.recipes enable row level security;
alter table public.cook_logs enable row level security;
alter table public.collections enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "family categories" on public.categories;
create policy "family categories" on public.categories for all to anon, authenticated using (true) with check (true);

drop policy if exists "family recipes" on public.recipes;
create policy "family recipes" on public.recipes for all to anon, authenticated using (true) with check (true);

drop policy if exists "family cook_logs" on public.cook_logs;
create policy "family cook_logs" on public.cook_logs for all to anon, authenticated using (true) with check (true);

drop policy if exists "family collections" on public.collections;
create policy "family collections" on public.collections for all to anon, authenticated using (true) with check (true);

drop policy if exists "family shopping_items" on public.shopping_items;
create policy "family shopping_items" on public.shopping_items for all to anon, authenticated using (true) with check (true);

alter table public.settings enable row level security;
drop policy if exists "family settings" on public.settings;
create policy "family settings" on public.settings for all to anon, authenticated using (true) with check (true);

alter table public.purchases enable row level security;
drop policy if exists "family purchases" on public.purchases;
create policy "family purchases" on public.purchases for all to anon, authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Xem một món qua link chia sẻ
-- ------------------------------------------------------------
create or replace function public.get_shared_recipe(p_share_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(r) from public.recipes r
  where r.share_id = p_share_id and r.deleted_at is null
$$;
revoke all on function public.get_shared_recipe(uuid) from public;
grant execute on function public.get_shared_recipe(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Kho ảnh
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

drop policy if exists "read recipe images" on storage.objects;
create policy "read recipe images" on storage.objects for select to anon, authenticated
  using (bucket_id = 'recipe-images');
drop policy if exists "upload recipe images" on storage.objects;
create policy "upload recipe images" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'recipe-images');
drop policy if exists "update recipe images" on storage.objects;
create policy "update recipe images" on storage.objects for update to anon, authenticated
  using (bucket_id = 'recipe-images');
drop policy if exists "delete recipe images" on storage.objects;
create policy "delete recipe images" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'recipe-images');

-- ------------------------------------------------------------
-- Không còn tạo danh mục theo tài khoản
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_default_categories();

-- Gộp danh mục trùng tên (bản cũ mỗi tài khoản có một bộ danh mục riêng)
with ranked as (
  select id, first_value(id) over (partition by lower(trim(name)) order by created_at, id) as keep_id
  from public.categories
)
update public.recipes r set category_id = ranked.keep_id
from ranked
where r.category_id = ranked.id and ranked.id <> ranked.keep_id;

delete from public.categories c
using (
  select id, first_value(id) over (partition by lower(trim(name)) order by created_at, id) as keep_id
  from public.categories
) d
where c.id = d.id and d.id <> d.keep_id;

-- Sổ còn trống thì tạo sẵn 6 danh mục
insert into public.categories (name, icon, sort_order)
select * from (values
  ('Món mặn', '🍖', 1),
  ('Canh & Súp', '🍲', 2),
  ('Món xào', '🥘', 3),
  ('Món chay', '🥗', 4),
  ('Tráng miệng', '🍮', 5),
  ('Đồ uống', '🧋', 6)
) as v(name, icon, sort_order)
where not exists (select 1 from public.categories);

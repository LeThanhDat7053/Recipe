-- ============================================================
-- Chạy toàn bộ file này trong Supabase: SQL Editor -> New query -> Run
-- Chạy lại nhiều lần vẫn an toàn (không mất dữ liệu).
-- Mỗi tài khoản có dữ liệu riêng, không ai xem được của ai.
-- ============================================================

-- ---------------- Danh mục ----------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '🍽️',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------- Công thức ----------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

-- Cột bổ sung (an toàn khi đã có bảng từ bản cũ)
alter table public.categories add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.recipes add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.recipes add column if not exists rating int not null default 0;          -- 0..5 sao
alter table public.recipes add column if not exists share_id uuid unique;                   -- link chia sẻ công khai
alter table public.recipes add column if not exists deleted_at timestamptz;                 -- thùng rác

-- ---------------- Nhật ký nấu ----------------
create table if not exists public.cook_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cooked_at timestamptz not null default now(),
  note text not null default ''
);

-- ---------------- Bộ sưu tập ----------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '📁',
  recipe_ids uuid[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------- Danh sách đi chợ ----------------
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount text not null default '',
  unit text not null default '',
  checked boolean not null default false,
  recipe_title text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories(user_id);
create index if not exists recipes_user_idx on public.recipes(user_id);
create index if not exists recipes_category_idx on public.recipes(category_id);
create index if not exists cook_logs_user_idx on public.cook_logs(user_id);
create index if not exists cook_logs_recipe_idx on public.cook_logs(recipe_id);
create index if not exists collections_user_idx on public.collections(user_id);
create index if not exists shopping_items_user_idx on public.shopping_items(user_id);

-- Tự cập nhật updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Bảo mật (RLS): mỗi người chỉ đọc/ghi dữ liệu của chính mình
-- ------------------------------------------------------------
drop policy if exists "read categories" on public.categories;
drop policy if exists "write categories" on public.categories;
drop policy if exists "read recipes" on public.recipes;
drop policy if exists "write recipes" on public.recipes;

alter table public.categories enable row level security;
alter table public.recipes enable row level security;
alter table public.cook_logs enable row level security;
alter table public.collections enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own recipes" on public.recipes;
create policy "own recipes" on public.recipes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own cook_logs" on public.cook_logs;
create policy "own cook_logs" on public.cook_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own collections" on public.collections;
create policy "own collections" on public.collections for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own shopping_items" on public.shopping_items;
create policy "own shopping_items" on public.shopping_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- Xem công thức qua link chia sẻ (không cần đăng nhập)
-- Chỉ trả về đúng 1 món theo mã bí mật, không liệt kê được món khác
-- ------------------------------------------------------------
create or replace function public.get_shared_recipe(p_share_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (to_jsonb(r) - 'user_id')
         || jsonb_build_object('author_name', coalesce(u.raw_user_meta_data->>'full_name', ''))
  from public.recipes r
  join auth.users u on u.id = r.user_id
  where r.share_id = p_share_id and r.deleted_at is null
$$;
revoke all on function public.get_shared_recipe(uuid) from public;
grant execute on function public.get_shared_recipe(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Kho ảnh: mỗi người upload vào thư mục <user_id>/...
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

drop policy if exists "upload recipe images" on storage.objects;
create policy "upload recipe images" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "update recipe images" on storage.objects;
create policy "update recipe images" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "delete recipe images" on storage.objects;
create policy "delete recipe images" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------
-- Tài khoản mới tự có sẵn 6 danh mục
-- ------------------------------------------------------------
create or replace function public.create_default_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories (user_id, name, icon, sort_order) values
    (new.id, 'Món mặn', '🍖', 1),
    (new.id, 'Canh & Súp', '🍲', 2),
    (new.id, 'Món xào', '🥘', 3),
    (new.id, 'Món chay', '🥗', 4),
    (new.id, 'Tráng miệng', '🍮', 5),
    (new.id, 'Đồ uống', '🧋', 6);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_default_categories();

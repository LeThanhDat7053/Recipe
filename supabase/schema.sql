-- ============================================================
-- Chạy toàn bộ file này trong Supabase: SQL Editor -> New query -> Run
-- Mỗi tài khoản có danh mục + công thức + ảnh riêng, không ai xem được của ai.
-- ============================================================

-- Danh mục
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '🍽️',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Công thức
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  prep_time int,            -- phút
  cook_time int,            -- phút
  servings int default 2,
  difficulty text default 'easy',   -- easy | medium | hard
  ingredients jsonb not null default '[]',  -- [{ id, type, amount, unit, name }]
  steps jsonb not null default '[]',        -- [{ id, text }]
  notes text default '',
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nếu trước đó đã chạy bản schema cũ (chưa có user_id)
alter table public.categories add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
alter table public.recipes add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;

create index if not exists categories_user_idx on public.categories(user_id);
create index if not exists recipes_user_idx on public.recipes(user_id);
create index if not exists recipes_category_idx on public.recipes(category_id);

-- Tự cập nhật updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Bảo mật (RLS): mỗi người chỉ đọc/ghi được dữ liệu của chính mình
-- ------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.recipes enable row level security;

-- Xoá policy của bản cũ (nếu có)
drop policy if exists "read categories" on public.categories;
drop policy if exists "write categories" on public.categories;
drop policy if exists "read recipes" on public.recipes;
drop policy if exists "write recipes" on public.recipes;

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own recipes" on public.recipes;
create policy "own recipes" on public.recipes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- Kho ảnh: mỗi người upload vào thư mục <user_id>/...
-- (Link ảnh là ngẫu nhiên, không đoán được)
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

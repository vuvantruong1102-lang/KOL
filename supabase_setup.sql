-- ============================================================
-- KOL Manager — script tạo cơ sở dữ liệu trên Supabase
-- Dùng chung project với app khác: bảng đặt tên riêng "kol_app_data".
-- Cách dùng: mở Supabase → SQL Editor → dán toàn bộ file này → Run.
-- ============================================================

-- 1) Bảng lưu dữ liệu (dạng key-value JSON).
--    Mỗi loại dữ liệu (kols, works, videos, templates, logs) là 1 dòng.
create table if not exists public.kol_app_data (
  k text primary key,
  v jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Bật Row Level Security: mặc định KHÔNG ai đọc/ghi được.
alter table public.kol_app_data enable row level security;

-- 3) Chỉ cho phép người ĐÃ ĐĂNG NHẬP đọc và ghi.
drop policy if exists "kol authenticated read"  on public.kol_app_data;
drop policy if exists "kol authenticated write" on public.kol_app_data;

create policy "kol authenticated read"
  on public.kol_app_data for select
  to authenticated
  using (true);

create policy "kol authenticated write"
  on public.kol_app_data for all
  to authenticated
  using (true)
  with check (true);

-- 4) Tự cập nhật updated_at mỗi lần ghi.
create or replace function public.kol_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_kol_touch on public.kol_app_data;
create trigger trg_kol_touch before update on public.kol_app_data
  for each row execute function public.kol_touch_updated_at();

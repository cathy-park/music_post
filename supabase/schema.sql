-- Supabase SQL Editor에서 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.diary_books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '우리의 작은 세계',
  subtitle text not null default '말로 다 못한 날들을 노래로 남겼어',
  recipient_name text not null default '',
  sender_name text not null default '',
  day_count integer not null default 100,
  cover_message text not null default '',
  share_token uuid not null default gen_random_uuid() unique,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.diary_books(id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  date_label text not null default '',
  comment text not null default '',
  lyrics text not null default '',
  audio_url text not null default '',
  cover_tone text not null default 'night' check (cover_tone in ('night','dawn','warm','forest')),
  icon text not null default '🎵',
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diary_books enable row level security;
alter table public.diary_entries enable row level security;

create policy "owner can read books"
on public.diary_books for select
using (auth.uid() = owner_id);

create policy "owner can insert books"
on public.diary_books for insert
with check (auth.uid() = owner_id);

create policy "owner can update books"
on public.diary_books for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner can delete books"
on public.diary_books for delete
using (auth.uid() = owner_id);

create policy "owner can read entries"
on public.diary_entries for select
using (
  exists (
    select 1 from public.diary_books b
    where b.id = diary_entries.book_id and b.owner_id = auth.uid()
  )
);

create policy "owner can insert entries"
on public.diary_entries for insert
with check (
  exists (
    select 1 from public.diary_books b
    where b.id = diary_entries.book_id and b.owner_id = auth.uid()
  )
);

create policy "owner can update entries"
on public.diary_entries for update
using (
  exists (
    select 1 from public.diary_books b
    where b.id = diary_entries.book_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.diary_books b
    where b.id = diary_entries.book_id and b.owner_id = auth.uid()
  )
);

create policy "owner can delete entries"
on public.diary_entries for delete
using (
  exists (
    select 1 from public.diary_books b
    where b.id = diary_entries.book_id and b.owner_id = auth.uid()
  )
);

-- 링크를 가진 익명 뷰어용 읽기 함수
create or replace function public.get_public_book(p_share_token text)
returns table (
  id uuid,
  title text,
  subtitle text,
  recipient_name text,
  sender_name text,
  day_count integer,
  cover_message text,
  share_token uuid,
  published boolean
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.title, b.subtitle, b.recipient_name, b.sender_name,
         b.day_count, b.cover_message, b.share_token, b.published
  from public.diary_books b
  where b.share_token::text = p_share_token and b.published = true
  limit 1;
$$;

create or replace function public.get_public_entries(p_share_token text)
returns table (
  id uuid,
  book_id uuid,
  title text,
  subtitle text,
  date_label text,
  comment text,
  lyrics text,
  audio_url text,
  cover_tone text,
  icon text,
  sort_order integer,
  published boolean
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.book_id, e.title, e.subtitle, e.date_label,
         e.comment, e.lyrics, e.audio_url, e.cover_tone, e.icon,
         e.sort_order, e.published
  from public.diary_entries e
  join public.diary_books b on b.id = e.book_id
  where b.share_token::text = p_share_token
    and b.published = true
    and e.published = true
  order by e.sort_order asc;
$$;

grant execute on function public.get_public_book(text) to anon, authenticated;
grant execute on function public.get_public_entries(text) to anon, authenticated;

-- Storage에서 music-diary-audio 이름의 버킷을 만든 뒤 public으로 설정하세요.
-- 파일명은 앱에서 UUID 기반 경로로 저장되어 추측이 어렵습니다.

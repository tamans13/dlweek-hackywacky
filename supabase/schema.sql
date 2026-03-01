-- Brainosaur Supabase schema
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.topic_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_name text not null,
  topic_name text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  storage_path text not null,
  extracted_text text,
  uploaded_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists topic_documents_user_module_topic_idx
  on public.topic_documents (user_id, module_name, topic_name, uploaded_at desc);

create table if not exists public.topic_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_name text not null,
  topic_name text not null,
  title text not null,
  questions jsonb not null,
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists topic_quizzes_user_module_topic_idx
  on public.topic_quizzes (user_id, module_name, topic_name, created_at desc);

create table if not exists public.topic_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.topic_quizzes(id) on delete cascade,
  module_name text not null,
  topic_name text not null,
  score integer not null,
  total integer not null,
  answers jsonb not null default '[]'::jsonb,
  result_breakdown jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists topic_quiz_attempts_user_module_topic_idx
  on public.topic_quiz_attempts (user_id, module_name, topic_name, submitted_at desc);

create index if not exists topic_quiz_attempts_quiz_idx
  on public.topic_quiz_attempts (quiz_id, submitted_at desc);

alter table public.user_app_state enable row level security;
alter table public.topic_documents enable row level security;
alter table public.topic_quizzes enable row level security;
alter table public.topic_quiz_attempts enable row level security;

-- RLS policies for authenticated users if you later choose direct client access.
drop policy if exists "Users can read own app state" on public.user_app_state;
create policy "Users can read own app state"
  on public.user_app_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert own app state" on public.user_app_state;
create policy "Users can upsert own app state"
  on public.user_app_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own topic docs" on public.topic_documents;
create policy "Users can read own topic docs"
  on public.topic_documents
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can write own topic docs" on public.topic_documents;
create policy "Users can write own topic docs"
  on public.topic_documents
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own quizzes" on public.topic_quizzes;
create policy "Users can read own quizzes"
  on public.topic_quizzes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can write own quizzes" on public.topic_quizzes;
create policy "Users can write own quizzes"
  on public.topic_quizzes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own quiz attempts" on public.topic_quiz_attempts;
create policy "Users can read own quiz attempts"
  on public.topic_quiz_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can write own quiz attempts" on public.topic_quiz_attempts;
create policy "Users can write own quiz attempts"
  on public.topic_quiz_attempts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create private bucket for topic uploads (7MB limit to match backend checks).
insert into storage.buckets (id, name, public, file_size_limit)
values ('study-files', 'study-files', false, 7340032)
on conflict (id) do nothing;

-- Optional storage policy if direct client uploads are ever used.
-- The current app uploads through backend service role and does not require this.
drop policy if exists "Users manage own files" on storage.objects;
create policy "Users manage own files"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'study-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'study-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

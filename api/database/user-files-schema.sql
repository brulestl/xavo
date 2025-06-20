-- Create user_files table for file attachments
create table if not exists public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid not null, -- References conversation_sessions(id) but no FK constraint due to API structure
  file_name text not null,
  file_url text not null,
  file_size integer not null,
  file_type text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.user_files enable row level security;

-- Create policy for users to access only their own files
create policy "Users can access their own files"
  on public.user_files for all
  using (auth.uid() = user_id);

-- Create index for faster queries
create index idx_user_files_user_id on public.user_files(user_id);
create index idx_user_files_session_id on public.user_files(session_id);

-- Create storage bucket for user files
insert into storage.buckets (id, name, public) 
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

-- Create storage policy for user files
create policy "Users can upload their own files"
  on storage.objects for insert
  with check (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own files"
  on storage.objects for select
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own files"
  on storage.objects for delete
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]); 
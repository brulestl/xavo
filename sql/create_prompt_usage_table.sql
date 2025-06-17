-- Create table for tracking daily prompt usage
create table if not exists public.prompt_usage (
  user_id uuid not null,
  usage_date date not null default current_date,
  used integer not null default 0,
  primary key(user_id, usage_date)
);

-- Add RLS policies for the prompt_usage table
alter table public.prompt_usage enable row level security;

-- Users can only see their own usage
create policy "Users can view own usage" on public.prompt_usage
  for select using (auth.uid() = user_id);

-- Users can insert their own usage records
create policy "Users can insert own usage" on public.prompt_usage
  for insert with check (auth.uid() = user_id);

-- Users can update their own usage records
create policy "Users can update own usage" on public.prompt_usage
  for update using (auth.uid() = user_id); 
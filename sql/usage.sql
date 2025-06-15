-- Xavo MVP · Usage Tracking                                      idempotent
-----------------------------------------------------------------------------

-- 1 · Table
create table if not exists user_usage (
  user_id      uuid primary key,
  prompts_used int     default 0,
  tokens_month int     default 0,
  updated_at   timestamptz default now()
);

comment on table  user_usage                     is 'Prompt & token counters';
comment on column user_usage.prompts_used        is 'Lifetime prompts (reset if desired)';
comment on column user_usage.tokens_month        is 'Rolling 30-day token total';

-- 2 · RPC
create or replace function fn_consume_prompt(
  p_user uuid,
  p_cap  int        -- hard cap to enforce
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_usage(user_id) values (p_user)
  on conflict (user_id) do nothing;

  update user_usage
     set prompts_used = prompts_used + 1,
         updated_at   = now()
   where user_id = p_user
     and prompts_used + 1 <= p_cap;

  return found;         -- TRUE = within cap, FALSE = hit cap
end;
$$;

comment on function fn_consume_prompt is
'Atomically checks & increments prompt count; returns bool cap ok/exceeded';

-- 3 · RLS (select-only for owner)
alter table user_usage enable row level security;

do $$
begin
  if not exists (
      select 1 from pg_policies
      where  tablename  = 'user_usage'
        and  policyname = 'user_sees_own_usage')
  then
    create policy user_sees_own_usage
      on user_usage for select
      using (auth.uid() = user_id);
  end if;
end$$;

-- 4 · Permissions
grant execute on function fn_consume_prompt to authenticated;

-- TEST GUIDE:
-- select fn_consume_prompt('00000000-0000-0000-0000-000000000000', 3);
--    → true, true, true, false on successive calls.

----------------------------------------------------------------------------- 
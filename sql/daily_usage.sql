-- Xavo · daily prompt caps  (idempotent)
create table if not exists daily_usage (
  user_id     uuid,
  usage_date  date,
  prompts_used int default 0,
  primary key (user_id, usage_date)
);

create or replace function fn_consume_daily(
  p_user uuid,
  p_cap  int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
begin
  insert into daily_usage(user_id, usage_date)
  values (p_user, v_today)
  on conflict do nothing;

  update daily_usage
     set prompts_used = prompts_used + 1
   where user_id = p_user
     and usage_date = v_today
     and prompts_used + 1 <= p_cap;

  return found;
end;
$$;

alter table daily_usage enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename='daily_usage'
       and policyname='user_reads_own')
  then
    create policy user_reads_own
      on daily_usage for select
      using (auth.uid() = user_id);
  end if;
end$$;

grant execute on function fn_consume_daily to authenticated; 
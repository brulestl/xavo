-- Create RPC function to consume daily prompt quota
create or replace function public.fn_consume_daily(
  p_cap integer,
  p_user uuid
)
returns void
language plpgsql
security definer
as $$
declare
  rec prompt_usage%rowtype;
begin
  -- look up today's row
  select * into rec 
  from public.prompt_usage 
  where user_id = p_user 
    and usage_date = current_date;

  if not found then
    -- first prompt today
    insert into public.prompt_usage(user_id, usage_date, used)
    values (p_user, current_date, 1);
  else
    if rec.used >= p_cap then
      raise exception 'Daily prompt quota of % exceeded', p_cap;
    end if;
    update public.prompt_usage
    set used = used + 1
    where user_id = p_user and usage_date = current_date;
  end if;
end;
$$;

-- Grant execute rights to authenticated users
grant execute on function public.fn_consume_daily(integer, uuid) to authenticated; 
-- Create RPC function to get current daily usage
create or replace function public.fn_get_daily_usage(
  p_user uuid
)
returns json
language plpgsql
security definer
as $$
declare
  usage_count integer := 0;
  usage_date date;
begin
  -- Get today's usage
  select used, usage_date 
  into usage_count, usage_date
  from public.prompt_usage 
  where user_id = p_user 
    and usage_date = current_date;

  -- Return usage info as JSON
  return json_build_object(
    'user_id', p_user,
    'usage_date', coalesce(usage_date, current_date),
    'used', usage_count,
    'remaining', null  -- frontend can calculate this based on user's tier
  );
end;
$$;

-- Grant execute rights to authenticated users
grant execute on function public.fn_get_daily_usage(uuid) to authenticated; 
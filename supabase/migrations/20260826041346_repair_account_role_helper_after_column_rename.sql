create or replace function private.current_user_role_v2()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and status = 'active'::public.profile_status
$$;

revoke all on function private.current_user_role_v2() from public, anon;
grant execute on function private.current_user_role_v2() to authenticated;

comment on function private.current_user_role_v2() is
  'Compatibility helper used by role-aware RPCs; reads the final profiles.role column.';

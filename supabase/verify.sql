-- Run with the SQL Editor or Supabase connector. Fixtures are rolled back.
begin;
do $$
declare r jsonb; view_key text; test_id uuid := gen_random_uuid(); secret_key text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  perform set_config('role', 'anon', true);
  r := public.youqi_create(test_id, secret_key, '同步测试', '2026-10-20T00:00:00Z', '2026-11-20T00:00:00Z');
  assert (r->>'can_edit')::boolean and (r->>'version')::int = 1, 'create failed';
  view_key := r->>'viewer_token';
  r := public.youqi_read(test_id, view_key);
  assert not (r->>'can_edit')::boolean and r->>'viewer_token' is null, 'viewer escalation';
  begin
    perform public.youqi_update(test_id, view_key, 'bad', '2026-10-20', '2026-11-20', 1);
    raise exception 'viewer update was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.youqi_read(test_id, repeat('0', 64));
    raise exception 'wrong token was allowed';
  exception when insufficient_privilege then null; end;
  r := public.youqi_update(test_id, secret_key, '已更新', '2026-10-20', '2026-11-20', 1);
  assert (r->>'version')::int = 2 and r->>'title' = '已更新', 'update failed';
  begin
    perform public.youqi_update(test_id, secret_key, 'stale', '2026-10-20', '2026-11-20', 1);
    raise exception 'stale update was allowed';
  exception when serialization_failure then null; end;
  r := public.youqi_create(test_id, secret_key, '重复创建不能覆盖', '2026-10-20', '2026-11-20');
  assert r->>'title' = '已更新', 'idempotency failed';
  begin
    execute 'select * from youqi_private.countdowns';
    raise exception 'direct table read was allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

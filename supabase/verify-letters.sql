-- All fixtures are rolled back. Existing countdowns and messages are untouched.
begin;
do $$
declare
  room uuid:=gen_random_uuid(); room_key text:=repeat('a',64); first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid();
  first_key text:=repeat('b',64); second_key text:=repeat('c',64); message uuid:=gen_random_uuid();
  first_auth jsonb; second_auth jsonb; pair jsonb; result jsonb; cursor bigint; count_rows integer;
begin
  perform public.youqi_create(room,room_key,'临时验证',now(),now()+interval '1 day');
  first_auth:=jsonb_build_object('id',first_id,'token',first_key); second_auth:=jsonb_build_object('id',second_id,'token',second_key);
  pair:=jsonb_build_object('members',jsonb_build_array(first_auth||jsonb_build_object('name','甲'),second_auth||jsonb_build_object('name','乙')));
  perform public.youqi_letters(room,room_key,'setup',pair);
  perform public.youqi_letters(room,room_key,'setup',pair);
  perform public.youqi_letters(room,room_key,'write',first_auth||jsonb_build_object('message_id',message,'body','第一条 🌙'));
  perform public.youqi_letters(room,room_key,'write',first_auth||jsonb_build_object('message_id',message,'body','第一条 🌙'));
  result:=public.youqi_letters(room,room_key,'list',second_auth);
  assert jsonb_array_length(result->'items')=1,'Retry must not duplicate';
  assert result->'items'->0->>'body'='第一条 🌙','Peer must see new content';
  begin
    perform public.youqi_letters(room,room_key,'write',second_auth||jsonb_build_object('message_id',message,'body','冒名修改','version',1));
    raise exception 'Cross-person update allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.youqi_letters(room,room_key,'delete',second_auth||jsonb_build_object('message_id',message,'version',1));
    raise exception 'Cross-person delete allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.youqi_letters(room,room_key,'list',first_auth||jsonb_build_object('token',repeat('d',64)));
    raise exception 'Invalid personal key accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.youqi_letters(room,room_key,'write',first_auth||jsonb_build_object('message_id',gen_random_uuid(),'body','too fast'));
    raise exception 'Rate limit missing' using errcode='23514';
  exception when raise_exception then null; end;
  perform public.youqi_letters(room,room_key,'write',first_auth||jsonb_build_object('message_id',message,'body','修改后的留言','version',1));
  begin
    perform public.youqi_letters(room,room_key,'write',first_auth||jsonb_build_object('message_id',message,'body','过期覆盖','version',1));
    raise exception 'Optimistic update missing';
  exception when serialization_failure then null; end;
  -- Synthetic fixtures bypass send throttling solely to exercise pagination.
  insert into youqi_private.letters(id,room_id,author_id,body) select gen_random_uuid(),room,first_id,'历史 '||i from generate_series(1,23) i;
  result:=public.youqi_letters(room,room_key,'list',second_auth);cursor:=(result->>'cursor')::bigint;
  assert jsonb_array_length(result->'items')=20 and cursor is not null,'First page';
  result:=public.youqi_letters(room,room_key,'list',second_auth||jsonb_build_object('before',cursor));
  assert jsonb_array_length(result->'items')=4 and result->>'cursor' is null,'Second page';
  perform public.youqi_letters(room,room_key,'delete',first_auth||jsonb_build_object('message_id',message,'version',2));
  assert not exists(select 1 from youqi_private.letters where id=message and not deleted),'Delete visibility';
end $$;
select 'Two-person access, idempotency, rate limits, edits, deletes and keyset history passed' as result;
rollback;

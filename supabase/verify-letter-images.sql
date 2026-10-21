-- Disposable fixtures, rolled back together with every statement below.
begin;
do $$
declare
  room uuid:=gen_random_uuid();room_key text:=repeat('a',64);
  first_id uuid:=gen_random_uuid();second_id uuid:=gen_random_uuid();image_id uuid:=gen_random_uuid();
  first_auth jsonb;second_auth jsonb;result jsonb;
begin
  perform public.youqi_create(room,room_key,'图片权限验证',now(),now()+interval '1 day');
  first_auth:=jsonb_build_object('id',first_id,'token',repeat('b',64));
  second_auth:=jsonb_build_object('id',second_id,'token',repeat('c',64));
  perform public.youqi_letters(room,room_key,'setup',jsonb_build_object('members',jsonb_build_array(first_auth||jsonb_build_object('name','甲'),second_auth||jsonb_build_object('name','乙'))));
  result:=public.youqi_letters(room,room_key,'media_reserve',first_auth||jsonb_build_object('image_id',image_id,'bytes',100,'width',120,'height',80));
  assert result->>'id'=image_id::text,'Upload reservation must retain its image ID';
  result:=public.youqi_letters(room,room_key,'media_read',first_auth||jsonb_build_object('images',jsonb_build_array(image_id)));
  assert jsonb_array_length(result->'images')=1,'An author can preview their own draft';
  result:=public.youqi_letters(room,room_key,'media_read',second_auth||jsonb_build_object('images',jsonb_build_array(image_id)));
  assert jsonb_array_length(result->'images')=0,'Unsent images must remain private';
  begin
    perform public.youqi_letters(room,room_key,'write',first_auth||jsonb_build_object('message_id',gen_random_uuid(),'body','','images',jsonb_build_array(image_id)));
    raise exception 'Unuploaded image was accepted';
  exception when insufficient_privilege then null;end;
  begin
    perform public.youqi_letters(room,room_key,'media_discard',second_auth||jsonb_build_object('image_id',image_id));
    raise exception 'Peer deleted an author draft';
  exception when insufficient_privilege then null;end;
  perform public.youqi_letters(room,room_key,'media_discard',first_auth||jsonb_build_object('image_id',image_id));
  assert not exists(select 1 from youqi_private.letter_images where id=image_id),'Discard must remove unused metadata';
end $$;
select 'Private drafts, missing-object checks and author-only removal passed' as result;
rollback;

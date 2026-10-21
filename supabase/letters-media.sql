-- Additive image support; existing text, room capabilities and personal identities remain valid.
create table youqi_private.letter_images (
  id uuid primary key,room_id uuid not null,author_id uuid not null,
  bytes integer not null check(bytes between 1 and 1200000),
  width integer not null check(width between 1 and 1800),height integer not null check(height between 1 and 1800),
  created_at timestamptz not null default now(),
  path text generated always as (room_id::text||'/'||author_id::text||'/'||id::text||'.jpg') stored,
  foreign key(room_id,author_id) references youqi_private.letter_people(room_id,id) on delete cascade
);
create index letter_images_owner_idx on youqi_private.letter_images(room_id,author_id,created_at);
alter table youqi_private.letter_images enable row level security;
revoke all on youqi_private.letter_images from public,anon,authenticated;
alter table youqi_private.letters add column image_ids uuid[] not null default '{}';
alter table youqi_private.letters drop constraint letters_body_check;
alter table youqi_private.letters add constraint letters_content_check check(char_length(btrim(body))<=500 and (char_length(btrim(body))>0 or cardinality(image_ids)>0) and cardinality(image_ids)<=3);
create index letters_images_idx on youqi_private.letters using gin(image_ids) where not deleted;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('youqi-letters','youqi-letters',false,1200000,array['image/jpeg']) on conflict(id) do nothing;
create or replace function youqi_private.letters_rpc(p_id uuid,p_token text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r youqi_private.countdowns;
  person youqi_private.letter_people;
  msg youqi_private.letters;
  m jsonb; members jsonb; result jsonb; page jsonb;
  editor boolean; person_id uuid; message_id uuid; before_seq bigint; expected bigint;
  text_body text; attachment_ids uuid[]; image_count integer; image_id uuid; image_row youqi_private.letter_images; rev bigint; other_seq bigint; minimum_seq bigint; more boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'No access' using errcode='42501'; end if;
  select * into r from youqi_private.countdowns where id=p_id and
    (editor_hash=encode(extensions.digest(p_token,'sha256'),'hex') or viewer_token=p_token);
  if not found then raise exception 'No access' using errcode='42501'; end if;
  editor := r.editor_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  if p_action='setup' then
    if not editor then raise exception 'No access' using errcode='42501'; end if;
    -- Serialize setup, including simultaneous attempts from two devices.
    perform 1 from youqi_private.countdowns where id=p_id for update;
    members:=p_payload->'members';
    if jsonb_typeof(members) is distinct from 'array' or jsonb_array_length(members)<>2 then raise exception 'Invalid members' using errcode='22023'; end if;
    for i in 0..1 loop
      m:=members->i;
      if coalesce(m->>'token','') !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(m->>'name',''))) not between 1 and 12 then raise exception 'Invalid members' using errcode='22023'; end if;
      person_id:=(m->>'id')::uuid;
      if person_id is null then raise exception 'Invalid member' using errcode='22023'; end if;
    end loop;
    if members->0->>'id'=members->1->>'id' or members->0->>'token'=members->1->>'token' then raise exception 'Distinct members required' using errcode='22023'; end if;
    if exists(select 1 from youqi_private.letter_books where room_id=p_id) then
      for i in 0..1 loop
        m:=members->i;
        if not exists(select 1 from youqi_private.letter_people where room_id=p_id and slot=i+1 and id=(m->>'id')::uuid and key_hash=encode(extensions.digest(m->>'token','sha256'),'hex')) then raise exception 'Already configured' using errcode='40001'; end if;
      end loop;
    else
      insert into youqi_private.letter_books(room_id) values(p_id);
      for i in 0..1 loop
        m:=members->i;
        insert into youqi_private.letter_people(id,room_id,slot,name,key_hash)
          values((m->>'id')::uuid,p_id,i+1,btrim(m->>'name'),encode(extensions.digest(m->>'token','sha256'),'hex'));
      end loop;
    end if;
    return jsonb_build_object('ready',true);
  end if;
  select revision into rev from youqi_private.letter_books where room_id=p_id;
  if not found then
    if p_action='status' then return jsonb_build_object('ready',false,'can_setup',editor); end if;
    raise exception 'Not configured' using errcode='42501';
  end if;
  if p_payload->>'id' is null and p_action='status' then return jsonb_build_object('ready',true,'needs_identity',true); end if;
  if coalesce(p_payload->>'token','') !~ '^[0-9a-f]{64}$' then raise exception 'No identity' using errcode='42501'; end if;
  select * into person from youqi_private.letter_people where room_id=p_id and id=(p_payload->>'id')::uuid
    and key_hash=encode(extensions.digest(p_payload->>'token','sha256'),'hex');
  if not found then raise exception 'No identity' using errcode='42501'; end if;
  if p_action='media_reserve' then
    perform 1 from youqi_private.letter_people where id=person.id for update;
    image_id:=(p_payload->>'image_id')::uuid;
    if image_id is null or (p_payload->>'bytes')::integer not between 1 and 1200000 or (p_payload->>'width')::integer not between 1 and 1800 or (p_payload->>'height')::integer not between 1 and 1800 then raise exception 'Invalid image' using errcode='22023'; end if;
    if (select count(*) from youqi_private.letter_images where room_id=p_id and author_id=person.id and created_at>now()-interval '1 day')>=100 then raise exception 'Image limit reached' using errcode='P0001'; end if;
    insert into youqi_private.letter_images(id,room_id,author_id,bytes,width,height) values(image_id,p_id,person.id,(p_payload->>'bytes')::integer,(p_payload->>'width')::integer,(p_payload->>'height')::integer) on conflict(id) do nothing;
    select * into image_row from youqi_private.letter_images where id=image_id and room_id=p_id and author_id=person.id;
    if not found then raise exception 'No access' using errcode='42501'; end if;
    return to_jsonb(image_row)-'author_id'-'room_id'-'created_at';
  end if;
  if p_action='media_read' then
    if jsonb_typeof(p_payload->'images') is distinct from 'array' or jsonb_array_length(p_payload->'images')>60 then raise exception 'Invalid images' using errcode='22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'path',i.path)),'[]'::jsonb) into page from youqi_private.letter_images i
      where i.room_id=p_id and i.id in (select value::uuid from jsonb_array_elements_text(p_payload->'images'))
      and (i.author_id=person.id or exists(select 1 from youqi_private.letters l where l.room_id=p_id and not l.deleted and l.image_ids @> array[i.id]));
    return jsonb_build_object('images',page);
  end if;
  if p_action='media_discard' then
    perform 1 from youqi_private.letter_books where room_id=p_id for update;
    image_id:=(p_payload->>'image_id')::uuid;
    select * into image_row from youqi_private.letter_images i where i.id=image_id and i.room_id=p_id and i.author_id=person.id for update;
    if not found then raise exception 'No access' using errcode='42501'; end if;
    if exists(select 1 from youqi_private.letters l where l.room_id=p_id and not l.deleted and l.image_ids @> array[image_id]) then return '{}'::jsonb; end if;
    delete from youqi_private.letter_images where id=image_id;
    return jsonb_build_object('path',image_row.path);
  end if;
  if p_action in ('write','delete') then
    -- One book lock serializes revisions and cross-device optimistic updates.
    perform 1 from youqi_private.letter_books where room_id=p_id for update;
  if p_action='write' then
    if p_payload ? 'images' then
      if jsonb_typeof(p_payload->'images') is distinct from 'array' or jsonb_array_length(p_payload->'images')>3 then raise exception 'Invalid images' using errcode='22023'; end if;
      select coalesce(array_agg(value::uuid),'{}'::uuid[]) into attachment_ids from jsonb_array_elements_text(p_payload->'images');
      select count(distinct id) into image_count from youqi_private.letter_images i where i.id=any(attachment_ids) and i.room_id=p_id and i.author_id=person.id and exists(select 1 from storage.objects o where o.bucket_id='youqi-letters' and o.name=i.path);
      if image_count<>cardinality(attachment_ids) then raise exception 'Images not uploaded or not yours' using errcode='42501'; end if;
    end if;
  end if;

    message_id:=(p_payload->>'message_id')::uuid;
    if message_id is null then raise exception 'Invalid message' using errcode='22023'; end if;
    select * into msg from youqi_private.letters where id=message_id;
    if found then
      if msg.room_id<>p_id or msg.author_id<>person.id or msg.deleted then raise exception 'Not yours' using errcode='42501'; end if;
      expected:=(p_payload->>'version')::bigint;
      -- A retried send with the same UUID is idempotent, even after a lost response.
      if p_action='write' and expected is null and msg.body=btrim(p_payload->>'body') and msg.image_ids=coalesce(attachment_ids,msg.image_ids) then return jsonb_build_object('saved',true,'id',msg.id); end if;
      if expected is null or expected<>msg.version then raise exception 'Changed' using errcode='40001'; end if;
      if p_action='delete' then
        update youqi_private.letters set deleted=true,body='已删除',version=version+1,updated_at=now() where id=message_id;
      else
        text_body:=btrim(p_payload->>'body');
        if text_body is null or char_length(text_body)>500 or (char_length(text_body)=0 and cardinality(coalesce(attachment_ids,msg.image_ids,'{}'::uuid[]))=0) then raise exception 'Invalid body' using errcode='22023'; end if;
        update youqi_private.letters set body=text_body,image_ids=coalesce(attachment_ids,msg.image_ids),version=version+1,updated_at=now() where id=message_id;
      end if;
    else
      if p_action='delete' or p_payload->>'version' is not null then raise exception 'Changed' using errcode='40001'; end if;
      text_body:=btrim(p_payload->>'body');
      if text_body is null or char_length(text_body)>500 or (char_length(text_body)=0 and cardinality(coalesce(attachment_ids,'{}'::uuid[]))=0) then raise exception 'Invalid body' using errcode='22023'; end if;
      select * into person from youqi_private.letter_people where id=person.id for update;
      if person.last_sent_at>now()-interval '3 seconds' then raise exception 'Please wait' using errcode='P0001'; end if;
      insert into youqi_private.letters(id,room_id,author_id,body,image_ids) values(message_id,p_id,person.id,text_body,coalesce(attachment_ids,'{}'::uuid[]));
      update youqi_private.letter_people set last_sent_at=now() where id=person.id;
    end if;
    update youqi_private.letter_books set revision=revision+1 where room_id=p_id;
    return jsonb_build_object('saved',true,'id',message_id);
  end if;
  select coalesce(max(seq),0) into other_seq from youqi_private.letters where room_id=p_id and author_id<>person.id and not deleted;
  result:=jsonb_build_object('ready',true,'revision',rev,'self',person.id,'name',person.name,'latest_other',other_seq);
  if p_action='status' then return result; end if;
  if p_action<>'list' then raise exception 'Invalid action' using errcode='22023'; end if;
  before_seq:=(p_payload->>'before')::bigint;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.seq desc),'[]'::jsonb),min(t.seq) into page,minimum_seq from (
    select l.id,l.seq,l.author_id as author,p.name,l.body,l.version,l.created_at,l.updated_at,
      coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'width',i.width,'height',i.height) order by array_position(l.image_ids,i.id)) from youqi_private.letter_images i where i.id=any(l.image_ids)),'[]'::jsonb) as images
      from youqi_private.letters l join youqi_private.letter_people p on p.id=l.author_id
      where l.room_id=p_id and not l.deleted and (before_seq is null or l.seq<before_seq) order by l.seq desc limit 20
  ) t;
  select exists(select 1 from youqi_private.letters where room_id=p_id and not deleted and seq<minimum_seq) into more;
  return result||jsonb_build_object('items',page,'cursor',case when more then minimum_seq else null end);
end $$;

revoke all on function youqi_private.letters_rpc(uuid,text,text,jsonb) from public;
grant usage on schema youqi_private to anon,authenticated;
grant execute on function youqi_private.letters_rpc(uuid,text,text,jsonb) to anon,authenticated;
create or replace function public.youqi_letters(p_id uuid,p_token text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select youqi_private.letters_rpc(p_id,p_token,p_action,p_payload);
$$;
revoke all on function public.youqi_letters(uuid,text,text,jsonb) from public;
grant execute on function public.youqi_letters(uuid,text,text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';

grant execute on function public.youqi_letters(uuid,text,text,jsonb) to service_role;
grant execute on function youqi_private.letters_rpc(uuid,text,text,jsonb) to service_role;

grant usage on schema youqi_private to service_role;

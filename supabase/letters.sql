-- Two-person notebook. Existing countdowns and their capabilities are unchanged.
-- Only hashes of personal keys are stored. Tables are private, with RLS and no client grants.
create table youqi_private.letter_books (
  room_id uuid primary key references youqi_private.countdowns(id) on delete cascade,
  revision bigint not null default 0
);
create table youqi_private.letter_people (
  id uuid primary key,
  room_id uuid not null references youqi_private.letter_books(room_id) on delete cascade,
  slot smallint not null check (slot in (1,2)),
  name text not null check (char_length(btrim(name)) between 1 and 12),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  last_sent_at timestamptz,
  unique(room_id,slot), unique(room_id,id)
);
create table youqi_private.letters (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  room_id uuid not null,
  author_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  version bigint not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(room_id,author_id) references youqi_private.letter_people(room_id,id) on delete cascade
);
create index letters_history_idx on youqi_private.letters(room_id,seq desc) where not deleted;
create index letters_author_idx on youqi_private.letters(room_id,author_id,seq desc);
alter table youqi_private.letter_books enable row level security;
alter table youqi_private.letter_people enable row level security;
alter table youqi_private.letters enable row level security;
revoke all on youqi_private.letter_books, youqi_private.letter_people, youqi_private.letters from public,anon,authenticated;
revoke all on sequence youqi_private.letters_seq_seq from public,anon,authenticated;

-- Definer logic stays in an unexposed schema. It uses the existing 256-bit room
-- capability plus an independently verified personal capability, not auth.uid().
create function youqi_private.letters_rpc(p_id uuid,p_token text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r youqi_private.countdowns;
  person youqi_private.letter_people;
  msg youqi_private.letters;
  m jsonb; members jsonb; result jsonb; page jsonb;
  editor boolean; person_id uuid; message_id uuid; before_seq bigint; expected bigint;
  text_body text; rev bigint; other_seq bigint; minimum_seq bigint; more boolean;
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
  if p_action in ('write','delete') then
    -- One book lock serializes revisions and cross-device optimistic updates.
    perform 1 from youqi_private.letter_books where room_id=p_id for update;
    message_id:=(p_payload->>'message_id')::uuid;
    if message_id is null then raise exception 'Invalid message' using errcode='22023'; end if;
    select * into msg from youqi_private.letters where id=message_id;
    if found then
      if msg.room_id<>p_id or msg.author_id<>person.id or msg.deleted then raise exception 'Not yours' using errcode='42501'; end if;
      expected:=(p_payload->>'version')::bigint;
      -- A retried send with the same UUID is idempotent, even after a lost response.
      if p_action='write' and expected is null and msg.body=btrim(p_payload->>'body') then return jsonb_build_object('saved',true,'id',msg.id); end if;
      if expected is null or expected<>msg.version then raise exception 'Changed' using errcode='40001'; end if;
      if p_action='delete' then
        update youqi_private.letters set deleted=true,body='已删除',version=version+1,updated_at=now() where id=message_id;
      else
        text_body:=btrim(p_payload->>'body');
        if text_body is null or char_length(text_body) not between 1 and 500 then raise exception 'Invalid body' using errcode='22023'; end if;
        update youqi_private.letters set body=text_body,version=version+1,updated_at=now() where id=message_id;
      end if;
    else
      if p_action='delete' or p_payload->>'version' is not null then raise exception 'Changed' using errcode='40001'; end if;
      text_body:=btrim(p_payload->>'body');
      if text_body is null or char_length(text_body) not between 1 and 500 then raise exception 'Invalid body' using errcode='22023'; end if;
      select * into person from youqi_private.letter_people where id=person.id for update;
      if person.last_sent_at>now()-interval '3 seconds' then raise exception 'Please wait' using errcode='P0001'; end if;
      insert into youqi_private.letters(id,room_id,author_id,body) values(message_id,p_id,person.id,text_body);
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
    select l.id,l.seq,l.author_id as author,p.name,l.body,l.version,l.created_at,l.updated_at
      from youqi_private.letters l join youqi_private.letter_people p on p.id=l.author_id
      where l.room_id=p_id and not l.deleted and (before_seq is null or l.seq<before_seq) order by l.seq desc limit 20
  ) t;
  select exists(select 1 from youqi_private.letters where room_id=p_id and not deleted and seq<minimum_seq) into more;
  return result||jsonb_build_object('items',page,'cursor',case when more then minimum_seq else null end);
end $$;

revoke all on function youqi_private.letters_rpc(uuid,text,text,jsonb) from public;
grant usage on schema youqi_private to anon,authenticated;
grant execute on function youqi_private.letters_rpc(uuid,text,text,jsonb) to anon,authenticated;
create function public.youqi_letters(p_id uuid,p_token text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select youqi_private.letters_rpc(p_id,p_token,p_action,p_payload);
$$;
revoke all on function public.youqi_letters(uuid,text,text,jsonb) from public;
grant execute on function public.youqi_letters(uuid,text,text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';

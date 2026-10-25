-- Read-only multi-select queries and counterpart reply activity; no existing data changes.
begin;
create index if not exists suggestion_reply_updates on youqi_private.suggestion_events(room_id,seq) where kind='reply';
create or replace function youqi_private.suggestions_rpc(p_id uuid,p_token text,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare who youqi_private.letter_people; item youqi_private.suggestions; event youqi_private.suggestion_events;
 result jsonb; entries jsonb; page_cursor bigint; before_seq bigint; more boolean; target_sites text[]; site text; new_state text; content text; entry_id uuid; item_id uuid; rev bigint; filter_sites text[]; filter_states text[]; after_seq bigint;
begin
 if coalesce(p_token,'')!~'^[0-9a-f]{64}$' or not exists(select 1 from youqi_private.countdowns c where c.id=p_id and (c.editor_hash=encode(extensions.digest(p_token,'sha256'),'hex') or c.viewer_token=p_token)) then raise exception 'No room access' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(p_payload->>'token','')!~'^[0-9a-f]{64}$' then raise exception 'Personal identity required' using errcode='42501';end if;
 select * into who from youqi_private.letter_people lp where lp.room_id=p_id and lp.id=(p_payload->>'id')::uuid and lp.key_hash=encode(extensions.digest(p_payload->>'token','sha256'),'hex');
 if not found then raise exception 'No personal access' using errcode='42501';end if;
 select coalesce((select b.revision from youqi_private.suggestion_books b where b.room_id=p_id),0) into rev;
 if p_action='status' then return jsonb_build_object('revision',rev);end if;
 if p_action='activity' then
  after_seq:=(p_payload->>'after')::bigint;
  if after_seq is null then
   select coalesce(max(e.seq),0) into after_seq from youqi_private.suggestion_events e where e.room_id=p_id and e.kind='reply' and e.author_id<>who.id;
   return jsonb_build_object('items','[]'::jsonb,'cursor',after_seq,'more',false,'revision',rev);
  end if;
  if after_seq<0 then raise exception 'Invalid update cursor' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by seq),'[]'::jsonb),coalesce(max(seq),after_seq) into entries,page_cursor from (
   select e.seq,e.suggestion_id,e.created_at,lp.name from youqi_private.suggestion_events e join youqi_private.letter_people lp on lp.id=e.author_id and lp.room_id=e.room_id
   where e.room_id=p_id and e.kind='reply' and e.author_id<>who.id and e.seq>after_seq order by e.seq limit 50)t;
  select exists(select 1 from youqi_private.suggestion_events e where e.room_id=p_id and e.kind='reply' and e.author_id<>who.id and e.seq>page_cursor) into more;
  return jsonb_build_object('items',entries,'cursor',page_cursor,'more',more,'revision',rev);
 end if;
 if p_action='list' then
  site:=coalesce(p_payload->>'site','main');new_state:=coalesce(p_payload->>'status','all');before_seq:=(p_payload->>'before')::bigint;
  if not youqi_private.valid_suggestion_sites(array[site]) or new_state not in ('all','open','review','working','done','paused','declined','transferred') or before_seq<1 then raise exception 'Invalid filter' using errcode='22023';end if;
  if p_payload ? 'sites' or p_payload ? 'statuses' then
   if jsonb_typeof(p_payload->'sites') is distinct from 'array' or jsonb_typeof(p_payload->'statuses') is distinct from 'array' then raise exception 'Invalid multi filter' using errcode='22023';end if;
   select coalesce(array_agg(value),array[]::text[]) into filter_sites from jsonb_array_elements_text(p_payload->'sites');
   select coalesce(array_agg(value),array[]::text[]) into filter_states from jsonb_array_elements_text(p_payload->'statuses');
   if cardinality(filter_sites)>64 or cardinality(filter_states)>7 or exists(select 1 from unnest(filter_sites) x where x is null or x !~ '^(main|memories|page:[a-z][a-z0-9-]{1,39})$') or exists(select 1 from unnest(filter_states) x where x is null or x not in ('open','review','working','done','paused','declined','transferred')) then raise exception 'Invalid multi filter' using errcode='22023';end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by seq desc),'[]'::jsonb),min(seq) into entries,page_cursor from (
   select s.*,lp.name,(select count(*) from youqi_private.suggestion_events e where e.room_id=p_id and e.suggestion_id=s.id and e.kind='reply') as replies from youqi_private.suggestions s join youqi_private.letter_people lp on lp.id=s.author_id
   where s.room_id=p_id and ((filter_sites is null and (site='main' or site=any(s.targets) or site=s.origin_site)) or (filter_sites is not null and (cardinality(filter_sites)=0 or s.targets && filter_sites or (s.origin_site<>'main' and s.origin_site=any(filter_sites))))) and ((filter_states is null and (new_state='all' or s.status=new_state)) or (filter_states is not null and (cardinality(filter_states)=0 or s.status=any(filter_states)))) and (before_seq is null or s.seq<before_seq) order by s.seq desc limit 20)t;
  select exists(select 1 from youqi_private.suggestions s where s.room_id=p_id and ((filter_sites is null and (site='main' or site=any(s.targets) or site=s.origin_site)) or (filter_sites is not null and (cardinality(filter_sites)=0 or s.targets && filter_sites or (s.origin_site<>'main' and s.origin_site=any(filter_sites))))) and ((filter_states is null and (new_state='all' or s.status=new_state)) or (filter_states is not null and (cardinality(filter_states)=0 or s.status=any(filter_states)))) and s.seq<page_cursor) into more;
  return jsonb_build_object('items',entries,'cursor',case when more then page_cursor else null end,'revision',rev);
 end if;
 item_id:=(p_payload->>'suggestion_id')::uuid;
 if p_action='create' then
  content:=btrim(coalesce(p_payload->>'body',''));site:=p_payload->>'origin';
  if jsonb_typeof(p_payload->'targets') is distinct from 'array' then raise exception 'Targets required' using errcode='22023';end if;
  select array_agg(value) into target_sites from jsonb_array_elements_text(p_payload->'targets');
  if item_id is null or char_length(content) not between 1 and 2000 or not youqi_private.valid_suggestion_sites(array[site]) or not youqi_private.valid_suggestion_sites(target_sites) or (site<>'main' and not site=any(target_sites)) then raise exception 'Invalid suggestion' using errcode='22023';end if;
  -- Lock the room's book so limits, revisions and idempotent retries serialize.
  insert into youqi_private.suggestion_books(room_id) values(p_id) on conflict do nothing;
  perform 1 from youqi_private.suggestion_books b where b.room_id=p_id for update;
  select * into item from youqi_private.suggestions s where s.id=item_id;
  if found then if item.room_id<>p_id or item.author_id<>who.id or item.body<>content or item.targets<>target_sites or item.origin_site<>site then raise exception 'ID already used' using errcode='42501';end if;return jsonb_build_object('id',item.id);end if;
  if (select count(*) from youqi_private.suggestions s where s.room_id=p_id)>=10000 or (select count(*) from youqi_private.suggestions s where s.room_id=p_id and s.author_id=who.id and s.created_at>now()-interval '1 day')>=60 then raise exception 'Suggestion limit reached' using errcode='P0001';end if;
  insert into youqi_private.suggestions(id,room_id,author_id,body,origin_site,targets) values(item_id,p_id,who.id,content,site,target_sites);
  update youqi_private.suggestion_books b set revision=b.revision+1 where b.room_id=p_id;
  return jsonb_build_object('id',item_id);
 end if;
 select * into item from youqi_private.suggestions s where s.room_id=p_id and s.id=item_id;
 if not found then raise exception 'No suggestion access' using errcode='42501';end if;
 if p_action='thread' then
  before_seq:=(p_payload->>'before')::bigint;
  if before_seq<1 then raise exception 'Invalid cursor' using errcode='22023';end if;
  select to_jsonb(s)||jsonb_build_object('name',lp.name) into result from youqi_private.suggestions s join youqi_private.letter_people lp on lp.id=s.author_id where s.id=item_id;
  select coalesce(jsonb_agg(to_jsonb(t) order by seq desc),'[]'::jsonb),min(seq) into entries,page_cursor from (
   select e.*,lp.name from youqi_private.suggestion_events e join youqi_private.letter_people lp on lp.id=e.author_id where e.room_id=p_id and e.suggestion_id=item_id and (before_seq is null or e.seq<before_seq) order by e.seq desc limit 30)t;
  select exists(select 1 from youqi_private.suggestion_events e where e.room_id=p_id and e.suggestion_id=item_id and e.seq<page_cursor) into more;
  return jsonb_build_object('item',result,'events',entries,'cursor',case when more then page_cursor else null end,'revision',rev);
 end if;
 if p_action not in ('reply','set') then raise exception 'Invalid action' using errcode='22023';end if;
 entry_id:=(p_payload->>'event_id')::uuid;content:=btrim(coalesce(p_payload->>'body',''));
 if entry_id is null or char_length(content)>1000 or (p_action='reply' and content='') then raise exception 'Invalid reply' using errcode='22023';end if;
 perform 1 from youqi_private.suggestion_books b where b.room_id=p_id for update;
 select * into event from youqi_private.suggestion_events e where e.id=entry_id;
 if found then if event.room_id<>p_id or event.author_id<>who.id or event.suggestion_id<>item_id or event.body<>content or (p_action='reply' and event.kind<>'reply') or (p_action='set' and (event.kind='reply' or event.new_status is distinct from p_payload->>'status' or (p_payload ? 'targets' and to_jsonb(event.new_targets) is distinct from p_payload->'targets'))) then raise exception 'ID already used' using errcode='42501';end if;return jsonb_build_object('id',item_id);end if;
 if (select count(*) from youqi_private.suggestion_events e where e.room_id=p_id and e.author_id=who.id and e.created_at>now()-interval '1 day')>=300 then raise exception 'Reply limit reached' using errcode='P0001';end if;
 select * into item from youqi_private.suggestions s where s.id=item_id for update;
 if p_action='reply' then
  insert into youqi_private.suggestion_events(id,room_id,suggestion_id,author_id,kind,body) values(entry_id,p_id,item_id,who.id,'reply',content);
 else
  if (p_payload->>'version')::bigint is distinct from item.version then raise exception 'Suggestion changed' using errcode='P4090';end if;
  new_state:=p_payload->>'status';
  if new_state is null or new_state not in ('open','review','working','done','paused','declined','transferred') then raise exception 'Invalid status' using errcode='22023';end if;
  target_sites:=item.targets;
  if p_payload ? 'targets' then if jsonb_typeof(p_payload->'targets') is distinct from 'array' then raise exception 'Invalid targets' using errcode='22023';end if;select array_agg(value) into target_sites from jsonb_array_elements_text(p_payload->'targets');end if;
  if not youqi_private.valid_suggestion_sites(target_sites) or (new_state='transferred' and not (p_payload ? 'targets')) then raise exception 'Transfer targets required' using errcode='22023';end if;
  insert into youqi_private.suggestion_events(id,room_id,suggestion_id,author_id,kind,body,old_status,new_status,old_targets,new_targets) values(entry_id,p_id,item_id,who.id,case when target_sites<>item.targets or new_state='transferred' then 'transfer' else 'status' end,content,item.status,new_state,item.targets,target_sites);
  update youqi_private.suggestions set status=new_state,targets=target_sites,version=version+1 where id=item_id;
 end if;
 update youqi_private.suggestions set updated_at=clock_timestamp() where id=item_id;
 update youqi_private.suggestion_books b set revision=b.revision+1 where b.room_id=p_id;
 return jsonb_build_object('id',item_id);
end $$;
notify pgrst,'reload schema';
commit;

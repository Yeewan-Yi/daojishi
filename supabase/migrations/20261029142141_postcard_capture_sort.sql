begin;
alter table youqi_private.journey_media add column if not exists captured_at timestamp,add column if not exists capture_offset text,add column if not exists latitude double precision,add column if not exists longitude double precision,add column if not exists place text;
create index if not exists journey_capture_order on youqi_private.journey_media(room_id,city_id,(coalesce(captured_at,taken_on::timestamp,created_at at time zone 'UTC')),seq) where state='ready';
create or replace function youqi_private.journey_rpc(p_id uuid,p_token text,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$

#variable_conflict use_variable
declare sort_order text;anchor_time timestamp;person youqi_private.letter_people; m youqi_private.journey_media; f jsonb;p jsonb;page jsonb;init integer;before_seq bigint;minimum_seq bigint;has_more boolean;media_id uuid;comment_id uuid;city text;body text;size_bytes bigint;thumb_size integer;used_bytes bigint;provider text;is_service boolean;
begin
 if coalesce(p_token,'')!~'^[0-9a-f]{64}$' or not exists(select 1 from youqi_private.countdowns c where c.id=p_id and (c.editor_hash=encode(extensions.digest(p_token,'sha256'),'hex') or c.viewer_token=p_token)) then raise exception 'No room access' using errcode='42501';end if;
 if p_action='city_status' then return jsonb_build_object('revision',coalesce((select revision from youqi_private.journey_books where room_id=p_id),-1));end if;
 if p_action='cities' then
  perform 1 from youqi_private.countdowns where id=p_id for update;
  insert into youqi_private.journey_books(room_id) values(p_id) on conflict do nothing;
  get diagnostics init=row_count;
  if init>0 then
   insert into youqi_private.journey_cities(room_id,city_id,name,country,region,longitude,latitude,geometry)
    select p_id,city_id,feature->'properties'->>'name','CHN',coalesce(feature->'properties'->>'region',''),(feature->'properties'->>'longitude')::double precision,(feature->'properties'->>'latitude')::double precision,feature->'geometry' from youqi_private.journey_defaults;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('type','Feature','properties',jsonb_build_object('id',c.city_id,'name',c.name,'country',c.country,'region',c.region,'longitude',c.longitude,'latitude',c.latitude,'visited',c.visited),'geometry',c.geometry) order by c.updated_at,c.city_id),'[]'::jsonb) into page from youqi_private.journey_cities c where c.room_id=p_id and (c.visited or coalesce((p_payload->>'include_archived')::boolean,false) and exists(select 1 from youqi_private.journey_media mm where mm.room_id=p_id and mm.city_id=c.city_id and mm.state='ready'));
  return jsonb_build_object('cities',page,'revision',(select revision from youqi_private.journey_books where room_id=p_id));
 end if;
 if coalesce(p_payload->>'token','')!~'^[0-9a-f]{64}$' then raise exception 'Personal identity required' using errcode='42501';end if;
 select * into person from youqi_private.letter_people where room_id=p_id and id=(p_payload->>'id')::uuid and key_hash=encode(extensions.digest(p_payload->>'token','sha256'),'hex');if not found then raise exception 'No personal access' using errcode='42501';end if;

 if p_action in ('albums','album_save','album_delete','album_move') then
  city:=p_payload->>'city';perform 1 from youqi_private.journey_cities where room_id=p_id and city_id=city for update;if not found then raise exception 'No city access' using errcode='42501';end if;
  if p_action='albums' then select coalesce(jsonb_agg(to_jsonb(t) order by created_at),'[]'::jsonb) into page from (select a.id,a.name,a.created_at,(select count(*) from youqi_private.journey_media mm where mm.room_id=p_id and mm.city_id=city and mm.album_id=a.id and mm.state='ready') as total from youqi_private.journey_albums a where a.room_id=p_id and a.city_id=city and not a.deleted)t;return jsonb_build_object('items',page);end if;
  comment_id:=nullif(p_payload->>'album_id','')::uuid;
  if p_action='album_save' then
   body:=btrim(coalesce(p_payload->>'name',''));if comment_id is null or char_length(body) not between 1 and 60 then raise exception 'Invalid album name' using errcode='22023';end if;
   if exists(select 1 from youqi_private.journey_albums where room_id=p_id and city_id=city and not deleted and lower(name)=lower(body) and id<>comment_id) then raise exception 'Album name already exists' using errcode='22023';end if;
   if exists(select 1 from youqi_private.journey_albums where id=comment_id and (room_id<>p_id or city_id<>city or deleted)) then raise exception 'No album access' using errcode='42501';end if;
   insert into youqi_private.journey_albums(id,room_id,city_id,name) values(comment_id,p_id,city,body) on conflict(id) do update set name=excluded.name where journey_albums.room_id=p_id and journey_albums.city_id=city and not journey_albums.deleted;if not found then raise exception 'No album access' using errcode='42501';end if;return jsonb_build_object('id',comment_id,'saved',true);
  end if;
  if comment_id is not null and not exists(select 1 from youqi_private.journey_albums where id=comment_id and room_id=p_id and city_id=city and not deleted) then raise exception 'No album access' using errcode='42501';end if;
  if p_action='album_delete' then
   if comment_id is null then raise exception 'Album required' using errcode='22023';end if;
   update youqi_private.journey_albums set deleted=true where id=comment_id and room_id=p_id;
   update youqi_private.journey_media set album_id=null,version=version+1 where room_id=p_id and city_id=city and album_id=comment_id;return jsonb_build_object('saved',true);
  end if;
  page:=p_payload->'media_ids';if jsonb_typeof(page) is distinct from 'array' or jsonb_array_length(page) not between 1 and 200 then raise exception 'Invalid selection' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(page) x where not exists(select 1 from youqi_private.journey_media mm where mm.id=x::uuid and mm.room_id=p_id and mm.city_id=city and mm.state='ready')) then raise exception 'No media access' using errcode='42501';end if;
  update youqi_private.journey_media set album_id=comment_id,version=version+1 where room_id=p_id and city_id=city and id in(select value::uuid from jsonb_array_elements_text(page));return jsonb_build_object('saved',true);
 end if;
 if p_action='city' then
  f:=p_payload->'feature';if not youqi_private.valid_journey_feature(f) or jsonb_typeof(p_payload->'visited') is distinct from 'boolean' then raise exception 'Invalid city' using errcode='22023';end if;p:=f->'properties';
  perform 1 from youqi_private.journey_books where room_id=p_id for update;
  if (select count(*) from youqi_private.journey_cities where room_id=p_id)>=1000 and not exists(select 1 from youqi_private.journey_cities where room_id=p_id and city_id=p->>'id') then raise exception 'City limit reached' using errcode='22023';end if;
  insert into youqi_private.journey_cities(room_id,city_id,name,country,region,longitude,latitude,geometry,visited) values(p_id,p->>'id',btrim(p->>'name'),case when p->>'country' in ('TWN','HKG','MAC') then 'CHN' else p->>'country' end,coalesce(p->>'region',''),(p->>'longitude')::double precision,(p->>'latitude')::double precision,f->'geometry',(p_payload->>'visited')::boolean)
  on conflict(room_id,city_id) do update set name=excluded.name,country=excluded.country,region=excluded.region,longitude=excluded.longitude,latitude=excluded.latitude,geometry=excluded.geometry,visited=excluded.visited,updated_at=now();update youqi_private.journey_books set revision=revision+1 where room_id=p_id;return jsonb_build_object('saved',true);
 end if;
 if p_action='covers' then
  select coalesce(jsonb_agg(to_jsonb(t) order by seq desc),'[]'::jsonb) into page from (select mm.seq,mm.id,mm.kind,mm.mime,mm.width,mm.height,mm.duration,mm.title,mm.body,mm.taken_on,mm.created_at,mm.author_id as author,lp.name,mm.version,mm.album_id,mm.captured_at,mm.capture_offset,mm.latitude,mm.longitude,mm.place from youqi_private.journey_media mm join youqi_private.letter_people lp on lp.id=mm.author_id where mm.room_id=p_id and mm.city_id=p_payload->>'city' and mm.state='ready' and (coalesce(p_payload->>'album','')='' or (p_payload->>'album'='unfiled' and mm.album_id is null) or mm.album_id::text=p_payload->>'album') and mm.kind='image' and mm.is_cover order by mm.seq desc limit 5)t;return jsonb_build_object('items',page,'cursor',null);
 end if;
 if p_action='album' then
  select coalesce(jsonb_agg(to_jsonb(t) order by month desc),'[]'::jsonb) into page from (select to_char(coalesce(taken_on,created_at::date),'YYYY-MM') as month,count(*)::integer as total,count(*) filter(where kind='image')::integer as images,count(*) filter(where kind='video')::integer as videos from youqi_private.journey_media where room_id=p_id and city_id=p_payload->>'city' and state='ready' and (coalesce(p_payload->>'album','')='' or (p_payload->>'album'='unfiled' and album_id is null) or album_id::text=p_payload->>'album') group by 1)t;return jsonb_build_object('months',page);
 end if;
 if p_action='list' then
  city:=p_payload->>'city';before_seq:=(p_payload->>'before')::bigint;sort_order:=coalesce(p_payload->>'sort','upload');
  if sort_order not in ('upload','oldest','newest') or coalesce(p_payload->>'kind','all') not in ('all','image','video') or coalesce(p_payload->>'month','')!~'^([0-9]{4}-(0[1-9]|1[0-2]))?$' then raise exception 'Invalid album filter' using errcode='22023';end if;
  if before_seq is not null then select coalesce(mm.captured_at,mm.taken_on::timestamp,mm.created_at at time zone 'UTC') into anchor_time from youqi_private.journey_media mm where mm.seq=before_seq and mm.room_id=p_id and mm.city_id=city;if not found then raise exception 'Invalid album cursor' using errcode='22023';end if;end if;
  select coalesce(jsonb_agg(to_jsonb(t)-'sort_key' order by case when sort_order='oldest' then sort_key end asc,case when sort_order='newest' then sort_key end desc,case when sort_order='oldest' then seq end asc,case when sort_order<>'oldest' then seq end desc),'[]'::jsonb) into page from (select mm.seq,mm.id,mm.kind,mm.mime,mm.width,mm.height,mm.duration,mm.title,mm.body,mm.taken_on,mm.created_at,mm.author_id as author,lp.name,mm.version,mm.album_id,mm.captured_at,mm.capture_offset,mm.latitude,mm.longitude,mm.place,coalesce(mm.captured_at,mm.taken_on::timestamp,mm.created_at at time zone 'UTC') as sort_key from youqi_private.journey_media mm join youqi_private.letter_people lp on lp.id=mm.author_id where mm.room_id=p_id and mm.city_id=city and mm.state='ready' and (coalesce(p_payload->>'album','')='' or (p_payload->>'album'='unfiled' and mm.album_id is null) or mm.album_id::text=p_payload->>'album') and (coalesce(p_payload->>'kind','all')='all' or mm.kind=p_payload->>'kind') and (coalesce(p_payload->>'month','')='' or to_char(coalesce(mm.taken_on,mm.created_at::date),'YYYY-MM')=p_payload->>'month') and (before_seq is null or (sort_order='upload' and mm.seq<before_seq) or (sort_order='oldest' and (coalesce(mm.captured_at,mm.taken_on::timestamp,mm.created_at at time zone 'UTC'),mm.seq)>(anchor_time,before_seq)) or (sort_order='newest' and (coalesce(mm.captured_at,mm.taken_on::timestamp,mm.created_at at time zone 'UTC'),mm.seq)<(anchor_time,before_seq))) order by case when sort_order='oldest' then coalesce(mm.captured_at,mm.taken_on::timestamp,mm.created_at at time zone 'UTC') end asc,case when sort_order='newest' then coalesce(mm.captured_at,mm.taken_on::timestamp,mm.created_at at time zone 'UTC') end desc,case when sort_order='oldest' then mm.seq end asc,case when sort_order<>'oldest' then mm.seq end desc limit 21)t;
  has_more:=jsonb_array_length(page)>20;if has_more then page:=page-20;end if;return jsonb_build_object('items',page,'cursor',case when has_more then (page->-1->>'seq')::bigint else null end);
 end if;
 media_id:=(p_payload->>'media_id')::uuid;

 if p_action='capture' then
  select * into m from youqi_private.journey_media where id=media_id and room_id=p_id and author_id=person.id and state in ('pending','ready') for update;if not found then raise exception 'No media access' using errcode='42501';end if;
  if (p_payload->>'captured_at' is not null and (p_payload->>'captured_at'!~'^(19[0-9]{2}|20[0-9]{2}|21[0-9]{2}|2200)-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$')) or (p_payload->>'capture_offset' is not null and (p_payload->>'captured_at' is null or p_payload->>'capture_offset'!~'^[+-](0[0-9]|1[0-4]):[0-5][0-9]$')) or (p_payload->>'latitude' is null)<>(p_payload->>'longitude' is null) or (p_payload->>'latitude' is not null and (jsonb_typeof(p_payload->'latitude')<>'number' or jsonb_typeof(p_payload->'longitude')<>'number' or abs((p_payload->>'latitude')::double precision)>90 or abs((p_payload->>'longitude')::double precision)>180)) or (p_payload->>'place' is not null and (jsonb_typeof(p_payload->'place')<>'string' or char_length(p_payload->>'place')>160)) then raise exception 'Invalid capture information' using errcode='22023';end if;
  update youqi_private.journey_media set captured_at=(p_payload->>'captured_at')::timestamp,capture_offset=p_payload->>'capture_offset',latitude=(p_payload->>'latitude')::double precision,longitude=(p_payload->>'longitude')::double precision,place=nullif(btrim(p_payload->>'place'),'') where id=media_id;return jsonb_build_object('saved',true);
 end if;
 if p_action like 'media_%' then
  is_service:=coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role'='service_role';if is_service is distinct from true then raise exception 'Internal media operation' using errcode='42501';end if;
  if p_action in ('media_geo_reserve','media_geo_store') then
   if char_length(btrim(coalesce(p_payload->>'query',''))) not between 1 and 160 or coalesce(p_payload->>'iso','')!~'^[a-z]{2}$' then raise exception 'Invalid city query' using errcode='22023';end if;
   city:=encode(extensions.digest((p_payload->>'iso')||'/'||lower(btrim(p_payload->>'query')),'sha256'),'hex');
   if p_action='media_geo_reserve' then
    perform pg_advisory_xact_lock(hashtext('youqi_journey_geocoder'));
    select data into page from youqi_private.journey_geocache where key=city and created_at>clock_timestamp()-interval '30 days';if found then return jsonb_build_object('cached',true,'result',page);end if;
    if exists(select 1 from youqi_private.journey_geocache where key='__rate__' and created_at>clock_timestamp()-interval '1100 milliseconds') then raise exception 'Search limit' using errcode='P0001';end if;
    insert into youqi_private.journey_geocache(key,created_at) values('__rate__',clock_timestamp()) on conflict(key) do update set created_at=excluded.created_at;return jsonb_build_object('cached',false);
   end if;
   page:=p_payload->'result';if jsonb_typeof(page) is distinct from 'array' or jsonb_array_length(page)>5 or octet_length(page::text)>400000 then raise exception 'Invalid geocoder result' using errcode='22023';end if;
   insert into youqi_private.journey_geocache(key,data) values(city,page) on conflict(key) do update set data=excluded.data,created_at=excluded.created_at;
   delete from youqi_private.journey_geocache where key<>'__rate__' and (created_at<clock_timestamp()-interval '30 days' or key in(select key from youqi_private.journey_geocache where key<>'__rate__' order by created_at desc offset 100));return jsonb_build_object('saved',true);
  end if;
  if p_action='media_reserve' then
   provider:=p_payload->>'provider';city:=p_payload->>'city';size_bytes:=(p_payload->>'bytes')::bigint;thumb_size:=(p_payload->>'thumb_bytes')::integer;
   if media_id is null or provider not in ('supabase','r2') or size_bytes is null or size_bytes not between 1 and 40000000 or thumb_size is null or thumb_size not between 1 and 180000 or p_payload->>'kind' not in ('image','video') or p_payload->>'mime' not in ('image/jpeg','video/mp4','video/webm') or (p_payload->>'kind'='image' and (p_payload->>'mime'<>'image/jpeg' or size_bytes>1200000)) or (p_payload->>'kind'='video' and p_payload->>'mime' not like 'video/%') or coalesce((p_payload->>'width')::integer,0) not between 1 and 20000 or coalesce((p_payload->>'height')::integer,0) not between 1 and 20000 or coalesce((p_payload->>'duration')::double precision,0) not between 0 and 600 or char_length(coalesce(p_payload->>'title',''))>80 or char_length(coalesce(p_payload->>'body',''))>2000 or not exists(select 1 from youqi_private.journey_cities where room_id=p_id and city_id=city and visited) then raise exception 'Invalid media' using errcode='22023';end if;
   if nullif(p_payload->>'album_id','') is not null then perform 1 from youqi_private.journey_albums where id=(p_payload->>'album_id')::uuid and room_id=p_id and city_id=city and not deleted for share;if not found then raise exception 'No album access' using errcode='42501';end if;end if;
   perform pg_advisory_xact_lock(hashtext('youqi_journey_storage'));
   select * into m from youqi_private.journey_media where id=media_id;
   if found then if m.room_id<>p_id or m.author_id<>person.id or m.city_id<>city or m.bytes<>size_bytes or m.thumb_bytes<>thumb_size or m.state='deleted' then raise exception 'No media access' using errcode='42501';end if;return to_jsonb(m);end if;
   if (select count(*) from youqi_private.journey_media where author_id=person.id and created_at>now()-interval '1 day')>=1000 then raise exception 'Daily upload limit' using errcode='P0001';end if;
   select coalesce(sum(bytes+thumb_bytes),0) into used_bytes from youqi_private.journey_media where journey_media.provider=provider;
   if provider='supabase' then used_bytes:=greatest(used_bytes,(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id='youqi-journey'))+(select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id<>'youqi-journey');end if;
   if used_bytes+size_bytes+thumb_size>(case when provider='r2' then 7000000000 else 700000000 end) then raise exception 'Archive capacity reached; expand storage before upload' using errcode='P0001';end if;
   insert into youqi_private.journey_media(id,room_id,city_id,author_id,provider,object_key,thumb_key,kind,mime,bytes,thumb_bytes,width,height,duration,title,body,taken_on,album_id) values(media_id,p_id,city,person.id,provider,p_id::text||'/'||media_id::text||'/view.'||case when p_payload->>'mime'='image/jpeg' then 'jpg' when p_payload->>'mime'='video/mp4' then 'mp4' else 'webm' end,p_id::text||'/'||media_id::text||'/thumb.jpg',p_payload->>'kind',p_payload->>'mime',size_bytes,thumb_size,(p_payload->>'width')::integer,(p_payload->>'height')::integer,coalesce((p_payload->>'duration')::double precision,0),coalesce(p_payload->>'title',''),coalesce(p_payload->>'body',''),nullif(p_payload->>'date','')::date,nullif(p_payload->>'album_id','')::uuid) returning * into m;return to_jsonb(m);
  end if;
  select * into m from youqi_private.journey_media where id=media_id and room_id=p_id and state<>'deleted';if not found then raise exception 'No media access' using errcode='42501';end if;
  if p_action in ('media_inspect','media_complete') and m.author_id<>person.id then raise exception 'Not yours' using errcode='42501';end if;
  if p_action='media_complete' then update youqi_private.journey_media set state='ready',ready_at=coalesce(ready_at,now()) where id=m.id;return jsonb_build_object('id',m.id,'saved',true);end if;
  if p_action='media_read' and m.state<>'ready' then raise exception 'Media not published' using errcode='42501';end if;
  if p_action in ('media_read','media_inspect') then return to_jsonb(m);end if;
  raise exception 'Unknown media action' using errcode='22023';
 end if;
 if p_action in ('comments','comment') then
  if not exists(select 1 from youqi_private.journey_media where id=media_id and room_id=p_id and state='ready') then raise exception 'No media access' using errcode='42501';end if;
  if p_action='comment' then
   body:=btrim(p_payload->>'body');comment_id:=(p_payload->>'comment_id')::uuid;if comment_id is null or char_length(coalesce(body,'')) not between 1 and 1000 then raise exception 'Invalid comment' using errcode='22023';end if;
   perform 1 from youqi_private.letter_people where id=person.id for update;
   if exists(select 1 from youqi_private.journey_comments where id=comment_id and room_id=p_id and author_id=person.id and journey_comments.media_id=media_id and journey_comments.body=body) then return jsonb_build_object('saved',true);end if;
   if exists(select 1 from youqi_private.journey_comments where author_id=person.id and created_at>now()-interval '2 seconds') then raise exception 'Please wait before commenting' using errcode='P0001';end if;
   insert into youqi_private.journey_comments(id,room_id,media_id,author_id,body) values(comment_id,p_id,media_id,person.id,body);return jsonb_build_object('saved',true);
  end if;
  before_seq:=(p_payload->>'before')::bigint;
  select coalesce(jsonb_agg(to_jsonb(t) order by seq desc),'[]'::jsonb),min(seq) into page,minimum_seq from (select c.seq,c.id,c.body,c.created_at,c.author_id as author,lp.name from youqi_private.journey_comments c join youqi_private.letter_people lp on lp.id=c.author_id where c.room_id=p_id and c.media_id=media_id and (before_seq is null or c.seq<before_seq) order by c.seq desc limit 30)t;
  select exists(select 1 from youqi_private.journey_comments c where c.room_id=p_id and c.media_id=media_id and c.seq<minimum_seq) into has_more;return jsonb_build_object('items',page,'cursor',case when has_more then minimum_seq else null end);
 end if;
 raise exception 'Unknown journey action' using errcode='22023';
end $$;

notify pgrst,'reload schema';
commit;

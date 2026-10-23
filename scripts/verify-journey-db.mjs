// Isolated PostgreSQL verification: no production connection, user content, or real file storage.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;console.log('PASS',message);};
try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema youqi_private;create schema extensions;create schema storage;
create function extensions.digest(value text,algorithm text) returns bytea language sql immutable as $$select sha256(convert_to(value,'UTF8'))$$;
create table youqi_private.countdowns(id uuid primary key,editor_hash text,viewer_token text);
create table youqi_private.letter_people(id uuid primary key,room_id uuid,name text,key_hash text,unique(room_id,id));
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,metadata jsonb);`);
await db.exec(fs.readFileSync(new URL('../supabase/journey.sql',import.meta.url),'utf8'));
const a='10000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002',p='30000000-0000-4000-8000-000000000003',q='40000000-0000-4000-8000-000000000004',r='50000000-0000-4000-8000-000000000005',id='60000000-0000-4000-8000-000000000006',commentId='70000000-0000-4000-8000-000000000007';
const roomKey=room=>(room===a?'a':'e').repeat(64),personKey=who=>(who===p?'b':who===q?'c':'d').repeat(64);
for(const room of [a,b])await db.query(`insert into youqi_private.countdowns values($1,encode(extensions.digest($2,'sha256'),'hex'),$2)`,[room,roomKey(room)]);
for(const [who,room,name] of [[p,a,'一'],[q,a,'二'],[r,b,'外']])await db.query(`insert into youqi_private.letter_people values($1,$2,$3,encode(extensions.digest($4,'sha256'),'hex'))`,[who,room,name,personKey(who)]);
const call=async(room,action,payload={},who=p)=>{const result=await db.query(`select public.youqi_journey($1,$2,$3,$4) as result`,[room,roomKey(room),action,{id:who,token:personKey(who),...payload}]);return result.rows[0].result;};
async function denied(fn,code,message){try{await fn();assert.fail(message);}catch(e){assert.equal(e.code,code,message);checks++;console.log('PASS',message);}}
async function role(name){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:name})]);if(name!=='postgres')await db.exec('set role '+name);}
await role('anon');
await denied(()=>db.query('select * from youqi_private.journey_media'),'42501','Anonymous clients cannot read private archive tables');
let result=await call(a,'cities');ok(result.cities.length===2,'Existing Nanjing and Shaoxing seed exactly once');await call(b,'cities',{},r);
const feature=result.cities[0];await call(a,'city',{feature,visited:false});ok((await call(a,'cities')).cities.length===1,'Unlighting persists without automatic reseeding');await call(a,'city',{feature,visited:true});
await denied(()=>call(a,'city',{feature,visited:true},r),'42501','Cross-room identities cannot change cities');
await denied(()=>call(a,'city',{feature,visited:true,id:q,token:personKey(p)}),'42501','One personal key cannot impersonate the other person');
await denied(()=>call(a,'city',{feature:{...feature,geometry:{type:'Point',coordinates:[0,0]}},visited:true}),'22023','Server rejects invalid city geometry');
const reservation={media_id:id,city:feature.properties.id,provider:'supabase',kind:'image',mime:'image/jpeg',bytes:100,thumb_bytes:50,width:100,height:100,title:'测试',body:'回忆'};
await denied(()=>call(a,'media_reserve',{...reservation,role:'service_role'}),'42501','Browser payload cannot impersonate the internal upload service');
await role('service_role');const geo={query:'Seattle',iso:'us'};ok(!(await call(a,'media_geo_reserve',geo)).cached,'Global geocoding reserves one website-wide search slot');await denied(()=>call(a,'media_geo_reserve',{query:'Portland',iso:'us'}),'P0001','Both people share the same geocoder rate limit');await call(a,'media_geo_store',{...geo,result:[]});ok((await call(a,'media_geo_reserve',geo)).cached,'Repeated city searches reuse the shared map cache');await call(a,'media_reserve',reservation);await call(a,'media_reserve',reservation);
await denied(()=>call(a,'media_reserve',reservation,q),'42501','A second author cannot take over a reserved object ID');
await call(a,'media_complete',{media_id:id});await role('anon');
ok((await call(a,'list',{city:feature.properties.id},q)).items.length===1,'The second person can read ready memories');ok((await call(b,'list',{city:feature.properties.id},r)).items.length===0,'Another room cannot list these memories');
await denied(()=>call(a,'media_read',{media_id:id}),'42501','Object paths and signing operations stay behind the media service');
await call(a,'comment',{media_id:id,comment_id:commentId,body:'一起记得'},q);await call(a,'comment',{media_id:id,comment_id:commentId,body:'一起记得'},q);ok((await call(a,'comments',{media_id:id})).items.length===1,'Retried comments are idempotent and shared');
await denied(()=>call(b,'comments',{media_id:id},r),'42501','Comments cannot cross room boundaries');
await call(a,'city',{feature,visited:false});ok((await call(a,'cities',{include_archived:true})).cities.some(f=>f.properties.id===feature.properties.id&&!f.properties.visited),'Unlighting preserves the city archive and its comments');await call(a,'city',{feature,visited:true});
await role('postgres');
for(let i=1;i<=24;i++){const next=`90000000-0000-4000-8000-${String(i).padStart(12,'0')}`;await db.query(`insert into youqi_private.journey_media(id,room_id,city_id,author_id,provider,object_key,thumb_key,kind,mime,bytes,thumb_bytes,width,height,state) select $1,room_id,city_id,author_id,provider,$2,$3,kind,mime,bytes,thumb_bytes,width,height,'ready' from youqi_private.journey_media where id=$4`,[next,'test/'+i+'/view','test/'+i+'/thumb',id]);}
await role('anon');const first=await call(a,'list',{city:feature.properties.id}),second=await call(a,'list',{city:feature.properties.id,before:first.cursor});ok(first.items.length===20&&second.items.length===5&&new Set([...first.items,...second.items].map(x=>x.id)).size===25,'History uses stable cursor pagination without duplicates');
await role('postgres');await db.exec(`update youqi_private.journey_media set taken_on=case when object_key like 'test/%' then date '2026-01-15' else date '2026-02-15' end`);await role('anon');
const january=await call(a,'list',{city:feature.properties.id,month:'2026-01',kind:'image'}),januaryEnd=await call(a,'list',{city:feature.properties.id,month:'2026-01',kind:'image',before:january.cursor});ok(january.items.length===20&&januaryEnd.items.length===4&&januaryEnd.cursor===null,'Month and media filters apply to both pagination and remaining-page detection');
ok((await call(a,'list',{city:feature.properties.id,kind:'video'})).items.length===0,'Video filtering covers all stored rows instead of only the loaded page');
const album=await call(a,'album',{city:feature.properties.id});ok(album.months.length===2&&album.months.find(m=>m.month==='2026-01').total===24,'Album month counts include the complete collection');await denied(()=>call(a,'album',{city:feature.properties.id},r),'42501','Album summaries retain the same personal room access checks');
await role('postgres');await db.query('update youqi_private.journey_media set is_cover=true where id=$1',[id]);await role('anon');ok((await call(a,'covers',{city:feature.properties.id},q)).items.length===1,'Selected covers are shared with the second person');await denied(()=>call(a,'covers',{city:feature.properties.id},r),'42501','Cover thumbnails retain personal room isolation');
await denied(()=>call(a,'list',{city:feature.properties.id,month:'2026-13'}),'22023','Invalid month filters are rejected before querying');
await role('postgres');await db.exec(`insert into storage.objects values('existing-letters','{"size":700000000}')`);await role('service_role');await denied(()=>call(a,'media_reserve',{...reservation,media_id:'80000000-0000-4000-8000-000000000008'}),'P0001','Capacity protection counts existing storage before reserving a new upload');await role('postgres');

await role('anon');const albumId='80000000-0000-4000-8000-000000000008';
await call(a,'album_save',{city:'cn:320100',album_id:albumId,name:'红山动物园'});
ok((await call(a,'albums',{city:'cn:320100'},q)).items.some(x=>x.id===albumId),'Albums are shared with the second person');
await call(a,'album_save',{city:'cn:320100',album_id:albumId,name:'游园'},q);
ok((await call(a,'albums',{city:'cn:320100'})).items.find(x=>x.id===albumId).name==='游园','Second person can rename an album');
await denied(()=>call(a,'album_save',{city:'cn:320100',album_id:albumId,name:'越界'},r),'42501','Cross-room identities cannot rename albums');
await denied(()=>call(a,'album_move',{city:'cn:330600',album_id:albumId,media_ids:[id]}),'42501','Albums cannot be used in another city');
await call(a,'album_move',{city:'cn:320100',album_id:albumId,media_ids:[id]});
ok((await call(a,'list',{city:'cn:320100',album:albumId})).items.some(x=>x.id===id),'Album filtering returns moved media');
await call(a,'album_delete',{city:'cn:320100',album_id:albumId},q);
let unfiled=await call(a,'list',{city:'cn:320100',album:'unfiled'});while(!unfiled.items.some(x=>x.id===id)&&unfiled.cursor)unfiled=await call(a,'list',{city:'cn:320100',album:'unfiled',before:unfiled.cursor});ok(unfiled.items.some(x=>x.id===id),'Deleting an album preserves its media as unfiled');
await denied(()=>call(a,'album_move',{city:'cn:320100',album_id:albumId,media_ids:[id]}),'42501','Deleted albums cannot receive media');

const protection=await db.query(`select count(*)::integer as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='youqi_private' and c.relname like 'journey_%' and c.relkind='r' and c.relrowsecurity`);ok(protection.rows[0].count===7,'Archive tables including albums and the public-map cache enable RLS');
console.log(`Archive PostgreSQL verification: ${checks} checks passed.`);
}catch(e){console.error({message:e.message,code:e.code,detail:e.detail,where:e.where,position:e.position});process.exitCode=1;}finally{await db.close();}

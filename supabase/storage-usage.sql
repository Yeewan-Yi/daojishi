-- Read-only owner-side snapshot. Run from the project's SQL editor or trusted management connection.
-- Do not expose this query through an anonymous browser RPC.
select pg_database_size(current_database()) as database_bytes,
       (select count(*) from youqi_private.letters where not deleted) as active_letters,
       (select count(*) from storage.objects where bucket_id='youqi-letters') as stored_images,
       (select coalesce(sum((metadata->>'size')::bigint),0)
          from storage.objects where bucket_id='youqi-letters') as image_bytes;

-- Largest application relations, including indexes, without reading private content.
select n.nspname as schema_name,c.relname as table_name,
       pg_total_relation_size(c.oid) as total_bytes
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='youqi_private' and c.relkind in ('r','m')
order by total_bytes desc;

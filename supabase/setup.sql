-- 有期：在 Supabase 项目的 SQL Editor 中完整运行一次。
-- 不需要关闭 RLS、不需要启用匿名登录，也不需要公开任何数据表。
-- 链接里的 256 位随机密钥代表访问权限；请只发送给信任的人。
begin;

create schema if not exists youqi_private;
revoke all on schema youqi_private from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

create table if not exists youqi_private.countdowns (
  id uuid primary key,
  title text not null check (char_length(btrim(title)) between 1 and 40),
  starts_at timestamptz not null check (isfinite(starts_at)),
  ends_at timestamptz not null check (isfinite(ends_at)),
  editor_hash text not null,
  viewer_token text not null check (viewer_token ~ '^[0-9a-f]{64}$'),
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '36600 days')
);
alter table youqi_private.countdowns enable row level security;
revoke all on youqi_private.countdowns from public, anon, authenticated;

create or replace function public.youqi_create(p_id uuid, p_token text, p_title text, p_start timestamptz, p_end timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r youqi_private.countdowns; token_hash text;
begin
  if p_id is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid link' using errcode = '22023';
  end if;
  token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  insert into youqi_private.countdowns (id, title, starts_at, ends_at, editor_hash, viewer_token)
  values (p_id, btrim(p_title), p_start, p_end, token_hash, encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (id) do nothing;
  select * into r from youqi_private.countdowns where id = p_id and editor_hash = token_hash;
  if not found then raise exception 'Invalid link' using errcode = '42501'; end if;
  return jsonb_build_object('id', r.id, 'title', r.title, 'start', r.starts_at, 'end', r.ends_at, 'version', r.version, 'can_edit', true, 'viewer_token', r.viewer_token);
end $$;

create or replace function public.youqi_read(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r youqi_private.countdowns; is_editor boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid link' using errcode = '42501'; end if;
  select * into r from youqi_private.countdowns
  where id = p_id and (editor_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') or viewer_token = p_token);
  if not found then raise exception 'Invalid link' using errcode = '42501'; end if;
  is_editor := r.editor_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('id', r.id, 'title', r.title, 'start', r.starts_at, 'end', r.ends_at, 'version', r.version, 'can_edit', is_editor, 'viewer_token', case when is_editor then r.viewer_token else null end);
end $$;

create or replace function public.youqi_update(p_id uuid, p_token text, p_title text, p_start timestamptz, p_end timestamptz, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r youqi_private.countdowns;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid link' using errcode = '42501'; end if;
  select * into r from youqi_private.countdowns
  where id = p_id and editor_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_version is null or r.version <> p_version then raise exception 'Version conflict' using errcode = '40001'; end if;
  update youqi_private.countdowns
  set title = btrim(p_title), starts_at = p_start, ends_at = p_end, version = version + 1, updated_at = now()
  where id = p_id returning * into r;
  return jsonb_build_object('id', r.id, 'title', r.title, 'start', r.starts_at, 'end', r.ends_at, 'version', r.version, 'can_edit', true, 'viewer_token', r.viewer_token);
end $$;

revoke all on function public.youqi_create(uuid, text, text, timestamptz, timestamptz) from public;
revoke all on function public.youqi_read(uuid, text) from public;
revoke all on function public.youqi_update(uuid, text, text, timestamptz, timestamptz, bigint) from public;
grant execute on function public.youqi_create(uuid, text, text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.youqi_read(uuid, text) to anon, authenticated;
grant execute on function public.youqi_update(uuid, text, text, timestamptz, timestamptz, bigint) to anon, authenticated;
notify pgrst, 'reload schema';
commit;

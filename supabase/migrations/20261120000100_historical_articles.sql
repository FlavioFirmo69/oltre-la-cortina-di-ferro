create schema if not exists scb_editorial;
revoke all on schema scb_editorial from public, anon, authenticated;

create table public.historical_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{5,100}$'),
  country text not null,
  season text not null,
  league text not null,
  title text not null,
  summary text not null,
  paragraphs jsonb not null check (jsonb_typeof(paragraphs)='array'),
  comment text not null,
  rules text not null,
  standings jsonb not null check (jsonb_typeof(standings)='array'),
  sources jsonb not null check (jsonb_typeof(sources)='array'),
  status text not null default 'draft' check(status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(country,season)
);
alter table public.historical_articles enable row level security;
revoke all on public.historical_articles from anon,authenticated;
grant select on public.historical_articles to anon,authenticated;
create policy published_history_read on public.historical_articles for select to anon,authenticated using(status='published' and published_at<=now());

create table scb_editorial.settings (
  singleton boolean primary key default true check(singleton),
  token_hash text not null,
  enabled boolean not null default true,
  heartbeat_at timestamptz
);
create table scb_editorial.runs (
  slot date primary key,
  lease uuid not null default gen_random_uuid(),
  attempts int not null default 1,
  status text not null check(status in ('running','failed','draft','published')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  slug text,
  review jsonb,
  reason text
);
revoke all on all tables in schema scb_editorial from public,anon,authenticated;

create function public.editorial_job(token text, action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  config scb_editorial.settings%rowtype;
  job scb_editorial.runs%rowtype;
  current_slot date := date_trunc('week',now() at time zone 'Europe/Rome')::date;
  result_status text;
  t jsonb; a jsonb; rows_json jsonb;
begin
  select * into config from scb_editorial.settings where singleton;
  if not found or token is null or length(token)<32 or config.token_hash<>encode(sha256(convert_to(token,'UTF8')),'hex') then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  if payload->>'slot' is distinct from current_slot::text then raise exception 'Invalid editorial week'; end if;
  perform pg_advisory_xact_lock(hashtext('scb-editorial-job'));
  update scb_editorial.settings set heartbeat_at=now() where singleton;
  if action='claim' then
    if not config.enabled then return jsonb_build_object('claimed',false,'status','disabled'); end if;
    select * into job from scb_editorial.runs where slot=current_slot for update;
    if found and (job.status in ('published','draft') or job.attempts>=3 or (job.status='running' and job.started_at>now()-interval '20 minutes')) then
      return jsonb_build_object('claimed',false,'status',job.status);
    end if;
    insert into scb_editorial.runs(slot,status) values(current_slot,'running')
      on conflict(slot) do update set status='running',lease=gen_random_uuid(),attempts=scb_editorial.runs.attempts+1,started_at=now(),finished_at=null,reason=null returning * into job;
    return jsonb_build_object('claimed',true,'lease',job.lease,'used',coalesce((select jsonb_agg(slug) from public.historical_articles),'[]'::jsonb));
  end if;
  select * into job from scb_editorial.runs where slot=current_slot for update;
  if not found or job.status<>'running' or job.lease::text is distinct from payload->>'lease' then raise exception 'Expired editorial lease'; end if;
  if action='fail' then
    update scb_editorial.runs set status='failed',finished_at=now(),reason=left(payload->>'reason',120) where slot=current_slot;
    return jsonb_build_object('status','failed');
  elsif action='complete' then
    t:=payload->'topic';a:=payload->'article';rows_json:=payload->'standings';
    if jsonb_array_length(rows_json) not between 10 and 24 or jsonb_array_length(a->'paragraphs') not between 2 and 4
      or length(a->>'title') not between 10 and 140 or length(a->>'summary') not between 40 and 350
      or (t->>'url') !~ '^https://www\.rsssf\.org/(tablesd/ddr[0-9]{2}|tabless/su[0-9]{2})\.html$'
      then raise exception 'Invalid article'; end if;
    result_status:=case when payload->'review'->>'approved'='true' and jsonb_array_length(payload->'review'->'issues')=0 then 'published' else 'draft' end;
    insert into public.historical_articles(slug,country,season,league,title,summary,paragraphs,comment,rules,standings,sources,status,published_at)
      values(t->>'slug',t->>'country',t->>'season',t->>'league',a->>'title',a->>'summary',a->'paragraphs',a->>'comment',a->>'rules',rows_json,
      jsonb_build_array(jsonb_build_object('title','RSSSF · '||(t->>'country')||' '||(t->>'season'),'url',t->>'url','accessed_at',now())),result_status,case when result_status='published' then now() else null end);
    update scb_editorial.runs set status=result_status,finished_at=now(),slug=t->>'slug',review=payload->'review' where slot=current_slot;
    return jsonb_build_object('status',result_status,'slug',t->>'slug');
  end if;
  raise exception 'Unknown editorial action';
end $$;
revoke all on function public.editorial_job(text,text,jsonb) from public;
grant execute on function public.editorial_job(text,text,jsonb) to anon;

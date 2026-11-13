create table public.kit_catalog (
 id text primary key, team_name text not null, aliases text[] not null default '{}',
 season text not null, variant text not null, shirt text not null, accent text not null,
 shorts text not null, socks text not null, pattern text not null,
 source_url text not null check (source_url like 'https://%'), source_note text not null
);
alter table public.kit_catalog enable row level security;
revoke all on public.kit_catalog from anon,authenticated;
grant select on public.kit_catalog to anon,authenticated;
create policy kit_catalog_public_read on public.kit_catalog for select to anon,authenticated using (true);
alter table public.candidates add column kit jsonb;
grant select(kit) on public.candidates to anon,authenticated;
insert into public.kit_catalog(id,team_name,aliases,season,variant,shirt,accent,shorts,socks,pattern,source_url,source_note) values
('spartak-moscow-1987-home','Spartak Mosca',array['Spartak Moscow','Spartak Moskva','FC Spartak Moscow'],'1987-1988','casa','#bd302e','#f4ecd8','#f4ecd8','#bd302e','band','https://www.footballkitarchive.com/spartak-moscow-1987-88-home-kit-66005/','Maglia rossa con fascia bianca documentata in archivio. Pantaloncini, calzettoni e dettagli sono una ricostruzione stilizzata modificabile.'),
('dynamo-dresden-1988-home','Dynamo Dresda',array['Dynamo Dresden','SG Dynamo Dresden','Dinamo Dresda','Dinamo Dresden'],'1988-1989','casa','#e6bd39','#252c29','#252c29','#e6bd39','plain','https://www.footballkitarchive.com/sg-dynamo-dresden-1988-89-home-kit-92182/','Maglia giallo oro con colletto e bordi neri documentata in archivio. Pantaloncini, calzettoni e dettagli sono una ricostruzione stilizzata modificabile.');
drop function public.save_registration(text,integer,text,text);
create function public.save_registration(candidate_id text, expected_version integer, new_team text, new_status text, new_kit jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.candidates%rowtype;
  changed public.candidates%rowtype;
  clean_team text;
begin
  if new_status is null or new_status not in ('pending','confirmed','declined') then
    raise exception 'Stato non valido.';
  end if;
  clean_team := case when new_status='confirmed' then btrim(regexp_replace(new_team,'\s+',' ','g')) else null end;
  if new_status='confirmed' and (clean_team is null or char_length(clean_team) not between 1 and 60) then
    raise exception 'Inserisci una squadra da 1 a 60 caratteri.';
  end if;
  if new_kit is not null then
    if jsonb_typeof(new_kit)<>'object' or octet_length(new_kit::text)>1500 then raise exception 'Divisa non valida.'; end if;
    if exists(select 1 from jsonb_object_keys(new_kit) k where k not in ('catalog_id','season','variant','shirt','accent','shorts','socks','pattern')) then raise exception 'Campo divisa non valido.'; end if;
    if exists(select 1 from unnest(array['shirt','accent','shorts','socks']) k where coalesce(new_kit->>k,'') !~ '^#[0-9a-fA-F]{6}$') then raise exception 'Colori divisa non validi.'; end if;
    if coalesce(new_kit->>'pattern','') not in ('plain','vertical','hoops','band','sash') or coalesce(new_kit->>'variant','') not in ('casa','trasferta','coppa') then raise exception 'Motivo o variante non validi.'; end if;
    if coalesce(new_kit->>'season','') !~ '^198[0-9]-(198[0-9]|1990)$' then raise exception 'Scegli una stagione degli anni Ottanta.'; end if;
    if right(new_kit->>'season',4)::int <> left(new_kit->>'season',4)::int+1 then raise exception 'Stagione non valida.'; end if;
    if new_kit->>'catalog_id' is not null and not exists(select 1 from public.kit_catalog where id=new_kit->>'catalog_id') then raise exception 'Divisa non trovata nel catalogo.'; end if;
  end if;
  select * into previous from public.candidates where id=candidate_id for update;
  if not found then raise exception 'Giocatore non trovato.'; end if;
  if expected_version is null or previous.version<>expected_version then
    raise exception 'Un altro partecipante ha modificato questo giocatore. Chiudi e premi Aggiorna.' using errcode='40001';
  end if;
  update public.candidates set team=clean_team,status=new_status,
    undecided=(name='Giulio' and new_status='pending'),
    kit=case when new_status<>'confirmed' then null when new_kit is not null then new_kit when clean_team=previous.team then previous.kit else null end,
    version=version+1,updated_at=now(),updated_by=auth.uid()
    where id=candidate_id returning * into changed;
  insert into public.registration_events(candidate_id,actor_id,before_value,after_value)
    values(candidate_id,auth.uid(),to_jsonb(previous),to_jsonb(changed));
exception when unique_violation then
  raise exception 'Questa squadra è già assegnata a un altro giocatore.' using errcode='23505';
end;
$$;
revoke all on function public.save_registration(text,integer,text,text,jsonb) from public;
grant execute on function public.save_registration(text,integer,text,text,jsonb) to anon, authenticated;

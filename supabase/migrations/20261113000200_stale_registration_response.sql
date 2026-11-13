-- Return stale versions as application errors, without triggering REST transaction retries.
create or replace function public.save_registration(candidate_id text, expected_version integer, new_team text, new_status text, new_kit jsonb default null)
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
    raise exception 'Un altro partecipante ha modificato questo giocatore. Chiudi e premi Aggiorna.' using errcode='P0001';
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

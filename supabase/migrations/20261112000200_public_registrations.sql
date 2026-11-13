-- Public registration mode requested by the club: no login, anyone with the URL can edit confirmations.
alter table public.registration_events alter column actor_id drop not null;
create policy candidates_public_read on public.candidates for select to anon, authenticated using (true);
revoke select on public.candidates from anon, authenticated;
grant select(id,name,ranking,team,status,undecided,version) on public.candidates to anon, authenticated;

create or replace function public.save_registration(candidate_id text, expected_version integer, new_team text, new_status text)
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
  select * into previous from public.candidates where id=candidate_id for update;
  if not found then raise exception 'Giocatore non trovato.'; end if;
  if expected_version is null or previous.version<>expected_version then
    raise exception 'Un altro partecipante ha modificato questo giocatore. Chiudi e premi Aggiorna.' using errcode='40001';
  end if;
  update public.candidates set team=clean_team,status=new_status,
    undecided=(name='Giulio' and new_status='pending'),
    version=version+1,updated_at=now(),updated_by=auth.uid()
    where id=candidate_id returning * into changed;
  insert into public.registration_events(candidate_id,actor_id,before_value,after_value)
    values(candidate_id,auth.uid(),to_jsonb(previous),to_jsonb(changed));
exception when unique_violation then
  raise exception 'Questa squadra è già assegnata a un altro giocatore.' using errcode='23505';
end;
$$;
revoke all on function public.save_registration(text,integer,text,text) from public;
grant execute on function public.save_registration(text,integer,text,text) to anon, authenticated;

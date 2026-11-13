-- Eseguire una sola volta in un progetto Supabase dedicato, dal SQL Editor.
begin;
create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.candidates (
  id text primary key,
  name text not null,
  ranking integer not null unique check (ranking between 1 and 12),
  team text,
  status text not null default 'pending' check (status in ('pending','confirmed','declined')),
  undecided boolean not null default false,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check ((status = 'confirmed' and team is not null and char_length(team) between 1 and 60 and team = btrim(team))
     or (status <> 'confirmed' and team is null))
);
create unique index candidates_unique_team on public.candidates (lower(team)) where team is not null;
create table public.registration_events (
  id bigint generated always as identity primary key,
  candidate_id text not null references public.candidates(id),
  actor_id uuid not null references auth.users(id),
  before_value jsonb not null,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;
alter table public.candidates enable row level security;
alter table public.registration_events enable row level security;
create policy members_read_self on public.members for select to authenticated using (user_id = (select auth.uid()));
create policy candidates_read_members on public.candidates for select to authenticated
  using (exists(select 1 from public.members where user_id=(select auth.uid())));
create policy events_read_members on public.registration_events for select to authenticated
  using (exists(select 1 from public.members where user_id=(select auth.uid())));
revoke all on public.members,public.candidates,public.registration_events from anon,authenticated;
grant select on public.members,public.candidates,public.registration_events to authenticated;

create function public.save_registration(candidate_id text, expected_version integer, new_team text, new_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.candidates%rowtype;
  changed public.candidates%rowtype;
  clean_team text;
begin
  if auth.uid() is null or not exists (select 1 from public.members where user_id=auth.uid()) then
    raise exception 'Account non abilitato al campionato.' using errcode='42501';
  end if;
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
    raise exception 'Un altro membro ha modificato questo giocatore. Chiudi e premi Aggiorna.' using errcode='40001';
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
revoke all on function public.save_registration(text,integer,text,text) from public,anon;
grant execute on function public.save_registration(text,integer,text,text) to authenticated;

insert into public.candidates(id,name,ranking,undecided) values
('p1','Flavio',1,false),('p2','Rudy',2,false),('p3','Andrea',3,false),
('p4','Bono',4,false),('p5','Grifo',5,false),('p6','Flanik',6,false),
('p7','Begnozzi',7,false),('p8','Salvi',8,false),('p9','Carmelo',9,false),
('p10','Omar',10,false),('p11','Leo',11,false),('p12','Giulio',12,true);
commit;

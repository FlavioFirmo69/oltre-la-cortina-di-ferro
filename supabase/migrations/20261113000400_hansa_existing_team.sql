insert into public.kit_catalog(id,team_name,aliases,season,variant,shirt,accent,shorts,socks,pattern,source_url,source_note) values ('hansa-rostock-1989-home','Hansa Rostock',array['FC Hansa Rostock','F.C. Hansa Rostock'],'1989-1990','casa','#f3f0e4','#1666ac','#1666ac','#f3f0e4','band','https://www.footballkitarchive.com/hansa-rostock-1989-90-home-kit-117874/','Maglia bianca con fascia orizzontale blu della stagione 1989/90, documentata in archivio. Completo e dettagli sono stilizzati e modificabili.') on conflict(id) do nothing;
do $$
declare c public.candidates%rowtype; k public.kit_catalog%rowtype; payload jsonb;
begin
 for c in select * from public.candidates where status='confirmed' and (kit is null or (kit->>'catalog_id' is null and not kit ? 'source' and kit @> '{"shirt":"#e7dfca","accent":"#434d43","shorts":"#434d43","socks":"#e7dfca","pattern":"plain"}'::jsonb)) loop
  select * into k from public.kit_catalog kc where lower(c.team)=lower(kc.team_name) or exists(select 1 from unnest(kc.aliases) a where lower(a)=lower(c.team)) order by season limit 1;
  if found then
   payload=jsonb_build_object('catalog_id',k.id,'season',k.season,'variant',k.variant,'shirt',k.shirt,'accent',k.accent,'shorts',k.shorts,'socks',k.socks,'pattern',k.pattern);
   perform public.save_registration(c.id,c.version,c.team,c.status,payload);
  end if;
 end loop;
end $$;

create or replace function public.publish_historical_article(article jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare article_slug text; item jsonb; rows_count int;
begin
  if article is null or jsonb_typeof(article)<>'object' then raise exception 'Articolo non valido'; end if;
  if coalesce(length(trim(article->>'title')),0) not between 5 and 140 then raise exception 'Il titolo deve contenere da 5 a 140 caratteri'; end if;
  if coalesce(length(trim(article->>'country')),0) not between 2 and 60 then raise exception 'Indica il paese'; end if;
  if coalesce(article->>'season','') !~ '^19[0-9]{2}(/[0-9]{2,4})?$' then raise exception 'Indica la stagione, per esempio 1987/88'; end if;
  if coalesce(length(article->>'summary'),0) not between 10 and 350 then raise exception 'Il sommario deve contenere da 10 a 350 caratteri'; end if;
  if jsonb_typeof(article->'paragraphs') is distinct from 'array' then raise exception 'Testo non valido'; end if;
  if jsonb_array_length(article->'paragraphs') not between 1 and 40 or length((article->'paragraphs')::text)>18000 then raise exception 'Testo troppo breve o troppo lungo'; end if;
  for item in select value from jsonb_array_elements(article->'paragraphs') loop
    if jsonb_typeof(item)<>'string' or length(item#>>'{}') not between 1 and 6000 then raise exception 'Paragrafo non valido'; end if;
  end loop;
  if length(coalesce(article->>'comment',''))>3000 or length(coalesce(article->>'rules',''))>1500 or length(coalesce(article->>'league',''))>80 then raise exception 'Campi troppo lunghi'; end if;
  if jsonb_typeof(article->'sources') is distinct from 'array' or jsonb_array_length(article->'sources')>10 then raise exception 'Fonti non valide'; end if;
  for item in select value from jsonb_array_elements(article->'sources') loop
    if coalesce(item->>'url','') !~ '^https://[^[:space:]]{3,1000}$' or coalesce(length(item->>'title'),0) not between 1 and 150 then raise exception 'Inserisci fonti con un indirizzo HTTPS valido'; end if;
  end loop;
  if jsonb_typeof(article->'standings') is distinct from 'array' or jsonb_array_length(article->'standings')>24 then raise exception 'Classifica non valida'; end if;
  rows_count:=0;
  for item in select value from jsonb_array_elements(article->'standings') loop
    rows_count:=rows_count+1;
    if coalesce(length(item->>'team'),0) not between 1 and 100 then raise exception 'Nome squadra non valido'; end if;
    if not (item ?& array['position','points','played','won','drawn','lost','gf','ga']) then raise exception 'Riga classifica incompleta'; end if;
    if exists(select 1 from jsonb_each_text(item) e where e.key in ('position','points','played','won','drawn','lost','gf','ga') and e.value !~ '^[0-9]{1,3}$') then raise exception 'Valori classifica non validi'; end if;
    if (item->>'position')::int<>rows_count then raise exception 'Posizioni classifica non consecutive'; end if;
    if (item->>'played')::int<>(item->>'won')::int+(item->>'drawn')::int+(item->>'lost')::int then raise exception 'Totale partite incoerente'; end if;
  end loop;
  article_slug:=trim(both '-' from regexp_replace(lower(article->>'title'),'[^a-z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8);
  insert into public.historical_articles(slug,country,season,league,title,summary,paragraphs,comment,rules,standings,sources,status,published_at)
    values(article_slug,trim(article->>'country'),article->>'season',coalesce(nullif(trim(article->>'league'),''),'Campionato nazionale'),trim(article->>'title'),trim(article->>'summary'),article->'paragraphs',coalesce(article->>'comment',''),coalesce(article->>'rules',''),article->'standings',article->'sources','published',now());
  return article_slug;
end $$;
revoke all on function public.publish_historical_article(jsonb) from public;
grant execute on function public.publish_historical_article(jsonb) to anon,authenticated;

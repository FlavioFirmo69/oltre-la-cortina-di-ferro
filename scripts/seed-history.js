import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {TOPICS,fetchSource,extractTable,weekSlot} from '../server/history.js';
const topic=TOPICS[0],standings=extractTable(await fetchSource(topic),topic);
const article={
  title:'Germania Est 1987/88: due squadre, trentasette punti',
  summary:'Berlino e Lipsia arrivano insieme al traguardo. La DDR-Oberliga 1987/88 consegna il titolo al Berliner FC Dynamo, davanti alla Lokomotive: stessa quota, percorsi diversi.',
  paragraphs:[
    'Il BFC chiude con 37 punti in 26 partite: quindici vittorie, sette pareggi e quattro sconfitte. La Lokomotive risponde con quattordici successi e nove pareggi. L’attacco dei berlinesi produce 59 reti, contro le 42 dei rivali; Lipsia concede invece soltanto 21 gol, la miglior difesa del campionato.',
    'La Dynamo Dresden completa il podio a 33 punti. In fondo, Vorwärts Frankfurt/Oder e Stahl Riesa retrocedono. Il Carl Zeiss Jena termina sesto, mentre l’Hansa Rostock è nono: nomi che ritroviamo anche sulle nostre basi da Subbuteo.'
  ],
  comment:'È una classifica da leggere oltre il totale dei punti: Berlino segna di più, Lipsia perde meno. Due modi di restare in corsa fino in fondo, con il titolo assegnato al BFC nell’ordine finale della fonte.',
  rules:'Ogni vittoria valeva 2 punti, il pareggio 1. Nel nostro torneo di Subbuteo, invece, la vittoria ne vale 3.'
};
const target=new URL(process.env.DATABASE_URL);target.searchParams.delete('sslmode');
const db=new pg.Client({connectionString:target.toString(),ssl:{rejectUnauthorized:true,ca:await readFile(process.env.DATABASE_CA_FILE||new URL('../supabase/ca.crt',import.meta.url),'utf8')}});
try{await db.connect();await db.query('begin');
  await db.query(`insert into public.historical_articles(slug,country,season,league,title,summary,paragraphs,comment,rules,standings,sources,status,published_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published',now()) on conflict(slug) do nothing`,[topic.slug,topic.country,topic.season,topic.league,article.title,article.summary,JSON.stringify(article.paragraphs),article.comment,article.rules,JSON.stringify(standings),JSON.stringify([{title:'RSSSF · East Germany 1987/88 · J. Schoenmakers e collaboratori',url:topic.url,accessed_at:new Date().toISOString()}])]);
  await db.query(`insert into scb_editorial.runs(slot,status,slug,finished_at,review) values($1,'published',$2,now(),'{"approved":true,"method":"pilot-reviewed-against-source"}') on conflict(slot) do update set status='published',slug=excluded.slug,finished_at=now(),review=excluded.review`,[weekSlot(),topic.slug]);
  await db.query('commit');console.log(JSON.stringify({published:topic.slug,teams:standings.length,nextSlot:'2026-11-23'}));
}catch(e){await db.query('rollback');throw e;}finally{await db.end();}

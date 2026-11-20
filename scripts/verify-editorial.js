import pg from 'pg';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {weekSlot} from '../server/history.js';
const uri=new URL(process.env.DATABASE_URL);uri.searchParams.delete('sslmode');
const db=new pg.Client({connectionString:uri.toString(),ssl:{rejectUnauthorized:true,ca:await readFile(process.env.DATABASE_CA_FILE||new URL('../supabase/ca.crt',import.meta.url),'utf8')}});
const secret=(await readFile(new URL('../.env.editorial.local',import.meta.url),'utf8')).match(/^CRON_SECRET=(\w+)$/m)[1];
try{await db.connect();await db.query('begin');
  await db.query('set local role anon');
  assert.equal((await db.query('select count(*)::int as n from public.historical_articles')).rows[0].n,1);
  for(const statement of ['select * from scb_editorial.settings',"update public.historical_articles set title='tamper'",'delete from public.historical_articles']){
    await db.query('savepoint denied');await assert.rejects(db.query(statement));await db.query('rollback to savepoint denied');
  }
  await db.query('savepoint denied');await assert.rejects(db.query('select public.editorial_job($1,$2,$3)',['wrong','claim',{slot:weekSlot()}]));await db.query('rollback to savepoint denied');
  await db.query('savepoint denied');await assert.rejects(db.query('select public.editorial_job($1,$2,$3)',[secret,'claim',{slot:weekSlot()}]));await db.query('rollback to savepoint denied');
  const article={title:'Prova transazionale articolo',country:'Paese di prova',season:'1981/82',league:'Test',summary:'Questo sommario serve soltanto alla verifica.',paragraphs:['Testo di prova, rimosso con rollback.'],comment:'',rules:'',standings:[],sources:[]};
  const published=(await db.query('select public.publish_historical_article($1) as slug',[article])).rows[0].slug;assert.match(published,/prova-transazionale/);
  assert.equal((await db.query('select count(*)::int n from public.historical_articles')).rows[0].n,2);
  await db.query('savepoint invalid');await assert.rejects(db.query('select public.publish_historical_article($1)',[{...article,title:''}]));await db.query('rollback to savepoint invalid');
  await db.query('reset role');
  const before=(await db.query('select count(*)::int n from public.candidates where status=$1',['confirmed'])).rows[0].n;assert.equal(before,12);
  await db.query('rollback');console.log(JSON.stringify({publicRead:true,privateSettingsHidden:true,anonymousWritesDenied:true,invalidTokenDenied:true,manualPublishVerified:true,automaticGenerationDisabled:true,playersStillConfirmed:before}));
}finally{await db.end();}

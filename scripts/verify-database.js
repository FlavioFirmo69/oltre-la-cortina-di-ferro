import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const target=new URL(process.env.DATABASE_URL);target.searchParams.delete('sslmode');
const ca=await readFile(new URL('../supabase/ca.crt',import.meta.url),'utf8');
const client=new pg.Client({connectionString:target.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15000,statement_timeout:15000});
try{
 await client.connect();
 const roster=await client.query('select id,name,ranking,status,team,version from public.candidates order by ranking');
 assert.deepEqual(roster.rows.map(r=>r.name),['Flavio','Rudy','Andrea','Bono','Grifo','Flanik','Begnozzi','Salvi','Carmelo','Omar','Leo','Giulio']);
 await client.query('begin');
 const original=roster.rows[0],second=roster.rows[1],testTeam=`SCB test ${randomUUID()}`;
 await client.query('set local role anon');
 assert.equal((await client.query('select id,name,ranking,status,team,version from public.candidates')).rowCount,12);
 async function rejected(sql,params,code){
   await client.query('savepoint rejected');
   await assert.rejects(client.query(sql,params),e=>e.code===code);
   await client.query('rollback to savepoint rejected');
 }
 await rejected("update public.candidates set name='Changed' where id='p1'",[],'42501');
 await rejected('select updated_by from public.candidates',[],'42501');
 await rejected('select * from public.registration_events',[],'42501');
 await rejected('select * from public.members',[],'42501');
 await client.query('select public.save_registration($1,$2,$3,$4)',['p1',original.version,testTeam,'confirmed']);
 assert.equal((await client.query("select status from public.candidates where id='p1'")).rows[0].status,'confirmed');
 await rejected('select public.save_registration($1,$2,$3,$4)',['p1',original.version,testTeam,'confirmed'],'40001');
 await rejected('select public.save_registration($1,$2,$3,$4)',['p2',second.version,testTeam,'confirmed'],'23505');
 await rejected('select public.save_registration($1,$2,$3,$4)',['p2',second.version,'   ','confirmed'],'P0001');
 await client.query('select public.save_registration($1,$2,$3,$4)',['p1',original.version+1,null,'pending']);
 const reset=(await client.query("select status,team from public.candidates where id='p1'")).rows[0];assert.equal(reset.status,'pending');assert.equal(reset.team,null);
 await client.query('reset role');
 assert.equal((await client.query('select count(*)::int as n from public.registration_events where candidate_id=$1 and after_value->>\'team\'=$2',['p1',testTeam])).rows[0].n,1);
 await client.query('rollback');
 console.log(JSON.stringify({verified:true,candidates:12,publicRead:true,publicConfirm:true,publicRevoke:true,rankingProtected:true,privateColumnsProtected:true,auditProtected:true,membersProtected:true,staleRejected:true,duplicateRejected:true,emptyTeamRejected:true,testChangesRolledBack:true}));
}catch(error){await client.query('rollback').catch(()=>{});console.error(JSON.stringify({verified:false,code:error.code||error.name,message:error instanceof assert.AssertionError?'Assertion failed':error.message}));process.exitCode=1;}
finally{await client.end().catch(()=>{});}

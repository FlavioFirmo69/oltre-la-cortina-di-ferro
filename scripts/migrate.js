import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const expectedProject='oppbprlmfkbqknbarnso';
let client;
try {
  const raw=process.env.DATABASE_URL;
  if(!raw)throw new Error('DATABASE_URL mancante nel file .env.database.local.');
  const target=new URL(raw);
  if(!['postgres:','postgresql:'].includes(target.protocol))throw new Error('DATABASE_URL deve essere una URI PostgreSQL.');
  if(!target.hostname.includes(expectedProject)&&!target.username.includes(expectedProject))throw new Error('La connessione non corrisponde al progetto Supabase previsto.');
  // TLS must validate the server certificate. Never accept an unverified certificate.
  target.searchParams.delete('sslmode');
  let certificate;
  if(process.env.DATABASE_CA_FILE){
    certificate=await readFile(process.env.DATABASE_CA_FILE,'utf8');
  }else{
    try{certificate=await readFile(new URL('../supabase/ca.crt',import.meta.url),'utf8');}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  client=new pg.Client({connectionString:target.toString(),ssl:{rejectUnauthorized:true,...(certificate?{ca:certificate}:{})},connectionTimeoutMillis:15000,statement_timeout:30000});
  await client.connect();
  const check=await client.query("select current_database() as database, to_regclass('auth.users') is not null as supabase_auth");
  if(!check.rows[0].supabase_auth)throw new Error('Il database non contiene Supabase Auth. Migrazione annullata.');
  if(process.argv.includes('--check')){
    const tables=await client.query("select tablename from pg_tables where schemaname='public' and tablename in ('members','candidates','registration_events','scb_schema_migrations') order by tablename");
    console.log(JSON.stringify({connected:true,supabaseAuth:true,tables:tables.rows.map(r=>r.tablename)}));
  }else{
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('scb-schema-migrations'))");
    await client.query('create table if not exists public.scb_schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())');
    await client.query('alter table public.scb_schema_migrations enable row level security');
    await client.query('revoke all on public.scb_schema_migrations from anon, authenticated');
    const directory=fileURLToPath(new URL('../supabase/migrations/',import.meta.url));
    const applied=[];
    for(const name of (await readdir(directory)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
      const rawSql=await readFile(`${directory}/${name}`,'utf8');
      const sql=rawSql.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const found=await client.query('select checksum from public.scb_schema_migrations where version=$1',[name]);
      if(found.rowCount){
        if(found.rows[0].checksum!==checksum){
          const legacyChecksum=createHash('sha256').update(rawSql).digest('hex');
          if(found.rows[0].checksum!==legacyChecksum)throw new Error(`Migrazione già applicata ma modificata: ${name}`);
          await client.query('update public.scb_schema_migrations set checksum=$1 where version=$2',[checksum,name]);
        }
        continue;
      }
      await client.query(sql);
      await client.query('insert into public.scb_schema_migrations(version,checksum) values($1,$2)',[name,checksum]);
      applied.push(name);
    }
    await client.query('commit');
    console.log(JSON.stringify({connected:true,applied}));
  }
}catch(error){
  try{await client?.query('rollback');}catch{}
  const codes={ENOTFOUND:'Host del database non raggiungibile tramite DNS.',ENETUNREACH:'Connessione di rete non disponibile per questo host (potrebbe richiedere IPv6).',ETIMEDOUT:'Timeout di connessione al database.', '28P01':'Password PostgreSQL non accettata.',SELF_SIGNED_CERT_IN_CHAIN:'Il certificato TLS richiede il certificato CA di Supabase.'};
  // Do not print connection strings, credentials or raw errors from network libraries.
  const known=codes[error.code];
  console.error(JSON.stringify({ok:false,code:error.code||error.name,message:known||(error.message?.includes(process.env.DATABASE_URL)?'Connessione non riuscita.':error.message)}));
  process.exitCode=1;
}finally{await client?.end().catch(()=>{});}

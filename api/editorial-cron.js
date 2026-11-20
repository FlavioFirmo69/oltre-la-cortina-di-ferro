import {timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
export function authorized(header,secret){
  if(!secret||typeof header!=='string')return false;
  const a=Buffer.from(header),b=Buffer.from(`Bearer ${secret}`);return a.length===b.length&&timingSafeEqual(a,b);
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  if(!authorized(req.headers.authorization,process.env.CRON_SECRET))return res.status(401).json({error:'Unauthorized'});
  try{
    const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
    const {error}=await db.from('historical_articles').select('id').limit(1);
    if(error)throw error;
    console.info('database_daily_check_ok');
    return res.status(200).json({ok:true,activity:'database-read',ai:false});
  }catch{console.error('database_daily_check_failed');return res.status(503).json({ok:false});}
}

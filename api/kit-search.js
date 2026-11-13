import {cleanKit} from '../src/kits.js';
const headers={'User-Agent':'SubbuteoClubBrescia/1.0 (historical football kit lookup; https://oltre-la-cortina-di-ferro.vercel.app/)'};
export function matchesSeasonTitle(title,season){
 const ranges=[...title.matchAll(/(198\d)[\s–—-]+(19\d{2}|\d{2})(?!\d)/g)];
 if(ranges.length)return ranges.some(m=>m[1]===season.slice(0,4)&&(m[2].length===2?'19'+m[2]:m[2])===season.slice(5));
 return new RegExp('\\b'+season.slice(5)+'\\b').test(title);
}
export function extractKit(text,season,variant){
 const index=variant==='trasferta'?'2':'1',parts=text.split(/\{\{\s*(?:football kit|divisa)\b/i);
 const chosen=parts.length>1?parts[index==='2'?2:1]?.split('}}')[0]||'':text;
 const value=key=>chosen.match(new RegExp('(?:^|[|\\n])\\s*'+key+'\\s*=\\s*([^|\\n}]+)','i'))?.[1]?.trim();
 const color=key=>{const v=value(key);return /^[0-9a-f]{6}$/i.test(v||'')?'#'+v.toLowerCase():null;};
 const shirt=color('body'+index)||color('body')||color('maglia');
 const shorts=color('shorts'+index)||color('shorts')||color('pantaloncini')||color('calzoncini');
 const socks=color('socks'+index)||color('socks')||color('calzettoni');
 const patternCode=value('pattern_b'+index)||value('pattern_b')||'';
 if(!shirt||!shorts||!socks)return null;
 const colors={red:'#b72c30',green:'#16834b',blue:'#1666ac',black:'#252c29',white:'#f4f1e7',yellow:'#e6bd39'};
 let accent=Object.entries(colors).find(([name,hex])=>patternCode.toLowerCase().includes(name)&&hex!==shirt)?.[1]||color('leftarm'+index)||shirt;
 let pattern=/hoops|horizontal/.test(patternCode)?'hoops':/sash|diagonal/.test(patternCode)?'sash':/stripes|stripesonwhite/.test(patternCode)?'vertical':/band|chest/.test(patternCode)?'band':'plain';
 if(/^_\w*\d{4}[hat]?\b/.test(patternCode)&&!Object.keys(colors).some(c=>patternCode.includes(c)))return null;
 if(shirt==='#ffffff'&&shorts==='#ffffff'&&socks==='#ffffff'&&accent==='#ffffff')return null;
 return cleanKit({season,variant,shirt,accent,shorts,socks,pattern});
}
export async function lookupKit(team,season,variant,fetcher=fetch){
 const signal=AbortSignal.timeout(14000),end=season.slice(5),start=season.slice(0,4),shortEnd=end.slice(2);
 const searches=await Promise.all(['it','en'].map(async lang=>{
  const u=new URL(`https://${lang}.wikipedia.org/w/api.php`);u.search=new URLSearchParams({action:'query',list:'search',srsearch:`${team} ${start} ${end}`,srlimit:'8',format:'json'});
  try{const response=await fetcher(u,{headers,signal});if(!response.ok)return[];const data=await response.json();return(data.query?.search||[]).filter(p=>matchesSeasonTitle(p.title,season)).slice(0,2).map(p=>({lang,title:p.title}));}catch{return[];}
 }));
 for(const p of searches.flat()){
  const u=new URL(`https://${p.lang}.wikipedia.org/w/api.php`);u.search=new URLSearchParams({action:'parse',page:p.title,prop:'wikitext',format:'json'});
  try{const response=await fetcher(u,{headers,signal});if(!response.ok)continue;const data=await response.json();const kit=extractKit(data.parse?.wikitext?.['*']||'',season,variant);if(kit)return{...kit,source:{url:`https://${p.lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replaceAll(' ','_'))}`,title:p.title,historical:true}};}catch{}
 }
 return null;
}
export async function GET(request){
 const url=new URL(request.url),team=(url.searchParams.get('team')||'').trim(),season=url.searchParams.get('season')||'1985-1986',variant=url.searchParams.get('variant')||'casa';
 if(team.length<3||team.length>60||!/^198\d-(198\d|1990)$/.test(season)||Number(season.slice(5))!==Number(season.slice(0,4))+1||!['casa','trasferta','coppa'].includes(variant))return Response.json({error:'Parametri di ricerca non validi.'},{status:400});
 const kit=await lookupKit(team,season,variant);
 return Response.json({kit,message:kit?'Divisa ricavata da una pagina della stagione; controlla la fonte.':'Non ho trovato una divisa leggibile per questa stagione. Scegli un’altra stagione o personalizza i colori.'},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=300'}});
}

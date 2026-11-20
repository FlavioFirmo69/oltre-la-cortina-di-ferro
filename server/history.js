// Editorial sources are curated, never supplied by visitors or by the model.
export const TOPICS = [88,87,86,85,84,83,82,81,89,90].flatMap(year=>[
  {slug:`germania-est-${year+1900-1}-${year+1900}`,country:'Germania Est',season:`${year+1900-1}/${String(year).padStart(2,'0')}`,league:'DDR-Oberliga',teams:14,format:'ddr',url:`https://www.rsssf.org/tablesd/ddr${year}.html`},
  // Other Soviet seasons need a separately documented draw-limit rule before inclusion.
  ...([88,86,89].includes(year)?[{slug:`unione-sovietica-${year+1900}`,country:'Unione Sovietica',season:String(year+1900),league:'Vysšaja Liga',teams:16,format:'standard',url:`https://www.rsssf.org/tabless/su${year}.html`}]:[]),
]);
export function sourceText(html){
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\r/g,'');
}
export async function fetchSource(topic){
  const res=await fetch(topic.url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'SCB-HistoricalArchive/1.0 (+https://oltre-la-cortina-di-ferro.vercel.app/)'}});
  if(!res.ok)throw new Error(`Fonte RSSSF non disponibile (${res.status})`);
  const reader=res.body.getReader();let length=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>900000)throw new Error('Fonte troppo estesa');chunks.push(value);}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks);
  if(bytes[0]===0xff&&bytes[1]===0xfe)return sourceText(new TextDecoder('utf-16le').decode(bytes));
  if(bytes[0]===0xfe&&bytes[1]===0xff)return sourceText(new TextDecoder('utf-16be').decode(bytes));
  const utf8=new TextDecoder().decode(bytes);
  return sourceText(utf8.includes('\ufffd')?new TextDecoder('windows-1252').decode(bytes):utf8);
}
export function extractTable(text,topic){
  // Use the first final top-flight table, never the later second-level tables.
  const start=text.search(/FINAL\s+TABLE\s*:/i);
  if(start<0)throw new Error('Classifica finale non individuata nella fonte');
  const lines=text.slice(start,start+14000).split('\n');const rows=[];
  for(const line of lines){
    let m,row;
    if(topic.format==='ddr'){
      m=line.match(/^\s*(\d+)\.\s*(.+?)\s*\.{2,}\s*(\d+)\s+(\d+)\s+(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s+(\d+)\s*:\s*(\d+)/);
      if(m)row={position:+m[1],team:m[2].trim(),points:+m[3],played:+m[4],won:+m[5],drawn:+m[6],lost:+m[7],gf:+m[8],ga:+m[9]};
    }else{
      m=line.match(/^\s*(\d+)\.\s*(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*[-:]\s*(\d+)\s+(\d+)/);
      if(m)row={position:+m[1],team:m[2].trim(),played:+m[3],won:+m[4],drawn:+m[5],lost:+m[6],gf:+m[7],ga:+m[8],points:+m[9]};
    }
    if(!row)continue;
    if(row.position!==rows.length+1)throw new Error('Classifica incompleta o duplicata');
    row.adjustment=row.points-(2*row.won+row.drawn);rows.push(row);
    if(rows.length===topic.teams)break;
  }
  validateTable(rows,topic,text.slice(0,3000)+'\n'+text.slice(Math.max(0,start-1800),start+14000));return rows;
}
export function validateTable(rows,topic,context=''){
  if(rows.length!==topic.teams)throw new Error('Numero di squadre non verificato');
  const sum=k=>rows.reduce((s,r)=>s+r[k],0);
  if(new Set(rows.map(r=>r.team)).size!==rows.length)throw new Error('Squadre duplicate');
  for(const [i,r] of rows.entries()){
    if(r.position!==i+1||!Object.values(r).every(v=>typeof v==='string'||Number.isInteger(v)))throw new Error('Riga non valida');
    if(['played','won','drawn','lost','gf','ga','points'].some(k=>r[k]<0)||r.played!==2*(topic.teams-1)||r.played!==r.won+r.drawn+r.lost)throw new Error('Partite incoerenti');
    if(r.adjustment!==0&&!(/draw limit|10 draws|penalt|deduct/i.test(context)&&topic.country==='Unione Sovietica'&&r.adjustment<=0))throw new Error('Punteggio speciale da verificare');
    if(i&&r.points>rows[i-1].points)throw new Error('Ordine classifica incoerente');
  }
  if(sum('gf')!==sum('ga')||sum('won')!==sum('lost')||sum('drawn')%2)throw new Error('Totali classifica incoerenti');
  return true;
}
export function weekSlot(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=t=>parts.find(p=>p.type===t).value;
  const d=new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}

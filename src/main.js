import {createClient} from '@supabase/supabase-js';
import {initialCandidates,allocation,validateTeam} from './registration.js';
import {KIT_CATALOG,DEFAULT_KIT,findTeamKits,fromCatalog,kitFigure} from './kits.js';
import {mountKitEditor} from './kit-editor.js';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null,root=document.querySelector('#app');
let demo=!db,candidates=[],catalog=KIT_CATALOG,filter='all',busy=false;
const storageKey='circolo-registrazioni-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusText={pending:'Da confermare',confirmed:'Confermato',declined:'Non partecipa'};
function notice(message){const el=document.querySelector('#notice');el.textContent=message;el.hidden=!message;}
function shell(content){
  root.innerHTML=`<header><a class="brand" href="/" aria-label="Subbuteo Club Brescia, home"><span class="crest" aria-hidden="true">SCB</span><span>SUBBUTEO CLUB <b>BRESCIA</b><small>PASSIONE SENZA CONFINI</small></span></a><div class="header-right"><span class="status">${demo?'MODALITÀ DEMO':'TORNEO DEL CLUB'}</span></div></header><main>${content}<p id="notice" class="notice" role="status" hidden></p></main><footer><strong>SUBBUTEO CLUB BRESCIA</strong><span>OLTRE LA CORTINA DI FERRO · IL CALCIO DELL’EST, SUL PANNO VERDE.</span></footer>`;
}
function loadDemo(){
  try{const saved=JSON.parse(localStorage.getItem(storageKey));candidates=Array.isArray(saved)&&saved.length===12?saved:initialCandidates();}catch{candidates=initialCandidates();}
}
async function loadRemote(){
  const [people,kits]=await Promise.all([db.from('candidates').select('id,name,ranking,team,status,undecided,version,kit').order('ranking'),db.from('kit_catalog').select('*').order('team_name')]);
  if(people.error)throw people.error;if(kits.error)throw kits.error;
  const data=people.data;catalog=kits.data;
  if(data.length!==12)throw new Error('Elenco del torneo incompleto. Contatta l’organizzatore.');
  candidates=data;
}
function render(){
  const a=allocation(candidates),shown=candidates.filter(c=>filter==='all'||c.status===filter);
  shell(`<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="edition-square"></span> TORNEO INTERNO · ISCRIZIONI APERTE</p><h1>OLTRE LA<br><em>CORTINA</em><br>DI FERRO<span class="title-dot">.</span></h1><p class="hero-subtitle">Il calcio dell’Est. Gli anni Ottanta.<br>Un tocco alla volta.</p><div class="hero-caption"><span>EST / 80</span> SCEGLI LA SQUADRA. ENTRA NEL TORNEO.</div></div><div class="tournament-poster" aria-hidden="true"><svg viewBox="0 0 440 500" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="print-lines" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0h5" stroke="#e7dbb9" stroke-width=".6" opacity=".22"/></pattern><clipPath id="poster-clip"><rect x="0" y="0" width="440" height="500"/></clipPath></defs><g clip-path="url(#poster-clip)"><path fill="#b33c2c" d="M0 0h440v500H0z"/><path fill="#e5d3a2" d="M210 290L20 0h73zm0 0L190 0h71zm0 0L355 0h85v15zm0 0l230-135v66zm0 0l230 22v63zm0 0L70 0H0v45z"/><text x="25" y="76" fill="#242c29" font-family="Impact,Arial Narrow,sans-serif" font-size="61" font-weight="900" letter-spacing="-2">EUROPA / EST</text><path fill="#263b35" d="M0 395l440-48v153H0z"/><path fill="none" stroke="#d5ce9f" stroke-width="2" d="M0 445l440-48m-440 77l440-48M65 426l44 74m70-87l41 87m70-100l40 100"/><path fill="#e6d6ac" d="M27 192h7v209h-7zm375-42h7v218h-7z"/><path stroke="#26332d" stroke-width="3" fill="#e6d6ac" d="M10 168h43v27H10zm374-42h43v27h-43z"/><path stroke="#26332d" stroke-width="2" d="M18 172v19m9-19v19m9-19v19m9-19v19m347-61v19m9-19v19m9-19v19m9-19v19"/><circle cx="225" cy="280" r="113" fill="#182d28" opacity=".22" transform="translate(8 13)"/><circle cx="225" cy="280" r="113" fill="#ebdfbd" stroke="#27322b" stroke-width="4"/><path fill="#26332d" d="M204 243l43-6 25 34-20 38-43-2-19-38zm-80 0l27-36 26 11-5 34-29 17zm129-72l35 12 16 34-24 9-24-23zm67 94l18 23-10 39-27-3-8-31zm-91 96l30-32 31 15-9 32-32 14zm-94-43l35 1 13 34-22 19-27-27z"/><path fill="none" stroke="#26332d" stroke-width="2" d="M204 243l-32 9m75-15l9-34m16 68l21 22m-41 16l7 20m-50-22l-39 12m-27-50l-9 49m43-100l39-45m88 44l16 48m-30 79l11-20m-139 48l48 18"/><path fill="#e5d3a2" d="M0 452l440-48v46L0 498z"/><text transform="translate(23 483) rotate(-6.2)" fill="#26332d" font-family="monospace" font-size="20" font-weight="700" letter-spacing="3">BRESCIA • SUBBUTEO • 80s</text><path fill="url(#print-lines)" d="M0 0h440v500H0z"/></g></svg><span class="poster-label">EDIZIONE SPECIALE</span></div></section>
  <div class="tournament-strip"><span>SQUADRE DELL’EUROPA ORIENTALE</span><span class="strip-star" aria-hidden="true">✦</span><span>ANNI OTTANTA</span><span class="strip-star" aria-hidden="true">✦</span><span>ANDATA & RITORNO</span></div>
  <div class="phase"><span class="phase-step current">01 <strong>Conferme e squadre</strong></span><span class="phase-line"></span><span class="phase-step">02 Composizione serie</span><span class="phase-line"></span><span class="phase-step">03 Campionato</span></div>
  <section class="stats registration-stats"><article><small>GIOCATORI NEL RANKING</small><strong>12<span>candidati</span></strong></article><article><small>CONFERMATI</small><strong>${a.confirmed.length}<span>con una squadra</span></strong><div class="progress"><i style="width:${a.confirmed.length/12*100}%"></i></div></article><article><small>CONFERME APERTE</small><strong>${a.pending}<span>in attesa</span></strong></article><article><small>COMPOSIZIONE</small><strong>${a.size===null?'—':`${a.size} + 6`}<span>${a.ready?'pronta da validare':a.size?'provvisoria':'da definire'}</span></strong></article></section>
  <section class="board"><div class="board-head"><nav aria-label="Filtra partecipanti">${[['all','Tutti'],['confirmed','Confermati'],['pending','In attesa'],['declined','Assenti']].map(([v,t])=>`<button data-filter="${v}" class="${filter===v?'selected':''}" aria-pressed="${filter===v}">${t}</button>`).join('')}</nav><button id="refresh" class="quiet">↻ Aggiorna</button></div>
  <div class="table-scroll"><table class="registration-table"><thead><tr><th>RANK</th><th>Giocatore</th><th>Squadra</th><th>Stato</th><th>Serie*</th><th><span class="sr-only">Azioni</span></th></tr></thead><tbody>${shown.map(c=>`<tr><td><span class="rank">${String(c.ranking).padStart(2,'0')}</span></td><th><span class="avatar">${esc(c.name.slice(0,2).toUpperCase())}</span>${esc(c.name)}</th><td class="team-cell">${c.team?teamIdentity(c):'<span class="unassigned">Squadra da assegnare</span>'}</td><td><span class="badge ${c.status}">${statusText[c.status]}</span></td><td><span class="division-badge">${a.divisions.get(c.id)||'—'}</span></td><td><button class="${c.status==='confirmed'?'quiet':'assign-button'}" data-edit="${esc(c.id)}">${c.status==='confirmed'?'Modifica':'Assegna squadra'} <span aria-hidden="true">↗</span></button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nessun giocatore in questa categoria.</td></tr>'}</tbody></table></div>
  <div class="table-foot">* Le serie dipendono dal numero finale dei partecipanti e seguono il ranking.</div></section>
  <section class="registration-bottom"><article class="format-card"><p class="eyebrow">DUE POSSIBILITÀ, UNA REGOLA</p><h2>Il ranking decide la serie.</h2><div class="format-options"><div><strong>11 giocatori</strong><p>Primi 5 partecipanti in <b>Serie A</b><br>Altri 6 in <b>Serie B</b></p><span>100 partite · 10 giornate per serie</span></div><div><strong>12 giocatori</strong><p>Primi 6 partecipanti in <b>Serie A</b><br>Altri 6 in <b>Serie B</b></p><span>120 partite · 10 giornate per serie</span></div></div></article><article class="readiness"><p class="eyebrow">IL PUNTO SULLE CONFERME</p><h2>${a.ready?'La rosa è completa.':a.pending?'Aspettiamo le ultime squadre.':'Numero partecipanti da rivedere.'}</h2><p>${a.ready?`Tutte le risposte sono registrate. Il ranking forma una Serie A da ${a.size} e una Serie B da 6.`:a.size?`Con ${a.confirmed.length} confermati, la proiezione è ${a.size}+6. Restano ${a.pending} risposte aperte: la composizione può cambiare.`:a.pending?`${a.confirmed.length} confermati su 12 candidati. La composizione apparirà al raggiungimento di 11 o 12 conferme.`:'Il formato previsto richiede 11 o 12 partecipanti confermati.'}</p>${a.size?`<div class="series-preview"><p><b>A</b> ${a.confirmed.filter(c=>a.divisions.get(c.id)==='A').map(c=>esc(c.name)).join(' · ')}</p><p><b>B</b> ${a.confirmed.filter(c=>a.divisions.get(c.id)==='B').map(c=>esc(c.name)).join(' · ')}</p></div>`:''}<p class="muted">Il calendario sarà il passo successivo, dopo la validazione delle conferme.</p></article></section>
  <aside class="rules"><strong>Quando si giocherà</strong><p>Andata e ritorno · Vittoria 3 punti · Pareggio 1 · Due retrocessioni dalla A e due promozioni dalla B. Per ora raccogliamo soltanto le conferme.</p></aside><div class="bottom-actions"><button id="export" class="quiet">↓ Esporta partecipanti CSV</button>${demo?'<span class="muted">Demo salvata solo in questo browser.</span><button id="reset" class="text-button">Azzera demo</button>':'<span class="muted">Accesso senza login · Chi ha il link può aggiornare le conferme.</span>'}</div>`);
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editCandidate(b.dataset.edit));
  document.querySelector('#refresh').onclick=async()=>{try{if(!demo)await loadRemote();render();notice('Elenco aggiornato.');}catch(err){notice(err.message);}};
  document.querySelector('#reset')?.addEventListener('click',()=>{if(confirm('Cancellare tutte le squadre e le conferme della demo?')){candidates=initialCandidates();persist();render();}});
  document.querySelector('#export').onclick=()=>{
    const rows=[['Ranking','Giocatore','Squadra','Stato','Serie provvisoria'],...candidates.map(c=>[c.ranking,c.name,c.team||'',statusText[c.status],a.divisions.get(c.id)||''])];
    const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"').join(';')).join('\r\n');
    const link=document.createElement('a'),blob=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.href=blob;link.download='conferme-subbuteo.csv';link.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);
  };
}
function persist(){if(demo)localStorage.setItem(storageKey,JSON.stringify(candidates));}
function teamIdentity(candidate){
  const fallback=findTeamKits(candidate.team,catalog)[0];
  const kit=candidate.kit||(fallback?fromCatalog(fallback):DEFAULT_KIT);
  return `<div class="team-identity">${kitFigure(kit,`row-${candidate.id}`)}<span>${esc(candidate.team)}<small>${candidate.kit||fallback?esc(kit.season.replace('-','/')):'Divisa da personalizzare'}</small></span></div>`;
}
function editCandidate(id){
  const c=candidates.find(c=>c.id===id),dialog=document.createElement('dialog');
  dialog.innerHTML=`<form id="candidate"><p class="eyebrow">RANKING #${c.ranking} · CONFERMA PARTECIPAZIONE</p><h2>${esc(c.name)} scende in campo.</h2><p class="modal-intro">Scegli una squadra dell’Est Europa degli anni ’80 per confermare la partecipazione. La serie verrà determinata dal ranking.</p><label>Nome della squadra<input name="team" maxlength="60" placeholder="La tua squadra dell’Est" autocomplete="off" required value="${esc(c.team||'')}"></label><p class="muted">Nome libero. Ogni squadra può essere assegnata a un solo giocatore.</p><p id="dialog-error" role="alert"></p><div class="dialog-actions"><button id="cancel" type="button" class="quiet">Annulla</button><button class="primary" type="submit">Assegna e conferma →</button></div><div class="other-status"><button id="pending" type="button" class="text-button">Lascia da confermare</button><button id="declined" type="button" class="text-button danger">Non partecipa</button></div></form>`;
  document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();dialog.querySelector('#cancel').onclick=()=>dialog.close();
  const kitSection=document.createElement('section');kitSection.id='kit-editor';dialog.querySelector('#dialog-error').before(kitSection);
  const editor=mountKitEditor(dialog.querySelector('form'),catalog,c);
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  const save=async(status,team)=>{
    if(busy)return;busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      if(status==='confirmed')team=validateTeam(team,candidates,id);else team=null;
      const kit=status==='confirmed'?editor.getKit():null;
      if(demo){Object.assign(c,{status,team,kit,version:c.version+1,undecided:c.name==='Giulio'&&status==='pending'});persist();}
      else{const {error}=await db.rpc('save_registration',{candidate_id:id,expected_version:c.version,new_team:team,new_status:status,new_kit:kit});if(error)throw error;await loadRemote();}
      dialog.close();render();notice(status==='confirmed'?`${c.name} confermato con ${team}.`:`Stato di ${c.name} aggiornato.`);
    }catch(err){dialog.querySelector('#dialog-error').textContent=err.message;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}finally{busy=false;}
  };
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();save('confirmed',new FormData(e.target).get('team'));};
  for(const status of ['pending','declined'])dialog.querySelector(`#${status}`).onclick=()=>{
    if(c.team&&!confirm('Questa operazione libera la squadra e annulla la conferma. Continuare?'))return;
    save(status,null);
  };
}
async function init(){
  if(!db){loadDemo();render();return;}
  try{await loadRemote();render();}
  catch(err){shell('<section class="login"><p class="eyebrow">SUBBUTEO CLUB BRESCIA</p><h2>Il torneo non è raggiungibile.</h2><p class="muted">I dati non sono stati caricati. Riprova tra poco.</p><button id="retry" class="primary">Riprova</button></section>');notice(err.message);document.querySelector('#retry').onclick=()=>init();}
}
init();

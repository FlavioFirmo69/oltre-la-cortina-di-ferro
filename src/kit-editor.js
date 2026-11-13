import {DEFAULT_KIT,PATTERNS,cleanKit,findTeamKits,fromCatalog,kitFigure,normalizeTeam,resolveKit} from './kits.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountKitEditor(form,catalog,candidate){
 const root=form.querySelector('#kit-editor'),team=form.elements.team;
 let matches=findTeamKits(team.value,catalog),kit=cleanKit(resolveKit(candidate,catalog)||DEFAULT_KIT);
 let unresolved=!resolveKit(candidate,catalog),searching=false,searchMessage='',timer,requestNumber=0;
 let previousTeam=normalizeTeam(team.value);
 team.setAttribute('list','kit-team-names');
 const suggestions=document.createElement('datalist');suggestions.id='kit-team-names';suggestions.innerHTML=[...new Set(catalog.map(k=>k.team_name))].map(n=>`<option value="${esc(n)}"></option>`).join('');team.after(suggestions);
 function metadata(){
  const record=catalog.find(k=>k.id===kit.catalog_id);
  root.querySelector('.kit-caption').textContent=record?`${record.team_name} · ${record.season.replace('-','/')} · ${record.variant}`:unresolved?'Divisa da trovare':kit.source?'Divisa trovata online · '+kit.season.replace('-','/'):'Divisa personalizzata · '+kit.season.replace('-','/');
  const source=root.querySelector('.kit-source');
  source.replaceChildren();
  if(record){const p=document.createElement('p');p.textContent=record.source_note;const a=document.createElement('a');a.textContent='Consulta la fonte storica ↗';a.href=record.source_url;a.target='_blank';a.rel='noopener noreferrer';source.append(p,a);}
  else if(kit.source){const p=document.createElement('p');p.textContent='Ricostruzione automatica dei dati della stagione. Controlla la fonte prima di confermare.';const a=document.createElement('a');a.textContent=kit.source.title+' ↗';a.href=kit.source.url;a.target='_blank';a.rel='noopener noreferrer';source.append(p,a);}
  else{const p=document.createElement('p');p.textContent=unresolved?'Non è stata assegnata una divisa neutra: attendi la ricerca o scegli i colori.':'Personalizzazione manuale: non presentata come divisa storica verificata.';source.append(p);}
  root.querySelector('.kit-search-status').textContent=searching?'Cerco la divisa della stagione online…':searchMessage;
  form.querySelector('[type="submit"]').disabled=searching||unresolved;
 }
 function paint(){root.querySelector('.kit-preview-art').innerHTML=unresolved?'<div class="kit-unresolved" aria-label="Divisa non ancora trovata">?</div>':kitFigure(kit,'editor');metadata();}
 function search(){
  clearTimeout(timer);const current=++requestNumber;
  if(team.value.trim().length<3){searching=false;searchMessage='Scrivi il nome della squadra.';paint();return;}
  searching=true;searchMessage='';paint();
  timer=setTimeout(async()=>{
   try{const parameters=new URLSearchParams({team:team.value.trim(),season:kit.season,variant:kit.variant});const response=await fetch('/api/kit-search?'+parameters,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error();const result=await response.json();if(current!==requestNumber)return;
    if(result.kit){kit=cleanKit(result.kit);unresolved=false;searchMessage='Divisa trovata. Puoi correggere i dettagli.';}else searchMessage=result.message;
   }catch{if(current!==requestNumber)return;searchMessage='Ricerca non disponibile. Riprova oppure personalizza la divisa.';}
   if(current===requestNumber){searching=false;render();}
  },650);
 }
 function render(){
  root.innerHTML=`<div class="kit-designer"><div class="kit-preview"><p class="eyebrow">IL TUO OMINO</p><div class="kit-preview-art"></div><p class="kit-caption" aria-live="polite"></p></div><div class="kit-settings"><label>Divisa dal catalogo<select name="kit-choice"><option value="">Personalizzata</option>${matches.map(k=>`<option value="${esc(k.id)}" ${kit.catalog_id===k.id?'selected':''}>${esc(k.season.replace('-','/'))} · ${esc(k.variant)}</option>`).join('')}</select></label><div class="kit-fields"><label>Stagione<select name="kit-season">${Array.from({length:10},(_,i)=>{const s=`${1980+i}-${1981+i}`;return `<option value="${s}" ${kit.season===s?'selected':''}>${s.replace('-','/')}</option>`;}).join('')}</select></label><label>Variante<select name="kit-variant">${['casa','trasferta','coppa'].map(v=>`<option ${kit.variant===v?'selected':''} value="${v}">${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label><label class="kit-pattern">Motivo maglia<select name="kit-pattern">${Object.entries(PATTERNS).map(([v,t])=>`<option value="${v}" ${kit.pattern===v?'selected':''}>${t}</option>`).join('')}</select></label>${[['shirt','Maglia'],['accent','Dettagli / motivo'],['shorts','Pantaloncini'],['socks','Calzettoni']].map(([key,label])=>`<label class="kit-color">${label}<input name="kit-${key}" type="color" value="${kit[key]}" aria-label="Colore ${label.toLowerCase()}"></label>`).join('')}</div></div></div><div class="kit-source"></div>`;
  root.insertAdjacentHTML('beforeend','<p class="kit-search-status" role="status" aria-live="polite"></p><div class="kit-search-actions"><button type="button" class="quiet kit-search-again">Cerca online</button><button type="button" class="quiet kit-use-manual">Personalizza</button></div>');
  root.querySelector('.kit-search-again').onclick=()=>{kit={...kit,catalog_id:null};delete kit.source;unresolved=true;search();};
  root.querySelector('.kit-use-manual').onclick=()=>{clearTimeout(timer);requestNumber++;searching=false;unresolved=false;kit={...kit,catalog_id:null};delete kit.source;searchMessage='Scegli i colori per creare la divisa.';render();};
  paint();
  root.querySelector('[name="kit-choice"]').onchange=e=>{clearTimeout(timer);requestNumber++;searching=false;unresolved=false;const record=matches.find(k=>k.id===e.target.value);kit=record?fromCatalog(record):{...kit,catalog_id:null};render();};
  for(const field of root.querySelectorAll('.kit-fields input,.kit-fields select'))field.addEventListener('input',()=>{
    const input={...kit,catalog_id:null};delete input.source;for(const key of ['shirt','accent','shorts','socks','pattern','season','variant'])input[key]=form.elements[`kit-${key}`].value;
    kit=cleanKit(input);root.querySelector('[name="kit-choice"]').value='';
    if(['kit-season','kit-variant'].includes(field.name)){unresolved=true;search();}else{clearTimeout(timer);requestNumber++;searching=false;unresolved=false;searchMessage='Divisa personalizzata.';paint();}
  });
 }
 team.addEventListener('input',()=>{
  const next=normalizeTeam(team.value);if(next===previousTeam)return;previousTeam=next;
  clearTimeout(timer);requestNumber++;searching=false;searchMessage='';matches=findTeamKits(team.value,catalog);kit=matches.length?fromCatalog(matches[0]):{...DEFAULT_KIT};unresolved=!matches.length;render();if(unresolved)search();
 });
 render();
 if(unresolved)search();
 return {getKit:()=>unresolved||searching?null:cleanKit(kit)};
}

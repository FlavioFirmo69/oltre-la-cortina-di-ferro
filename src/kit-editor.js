import {DEFAULT_KIT,PATTERNS,cleanKit,findTeamKits,fromCatalog,kitFigure,normalizeTeam} from './kits.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountKitEditor(form,catalog,candidate){
 const root=form.querySelector('#kit-editor'),team=form.elements.team;
 let matches=findTeamKits(team.value,catalog),kit=cleanKit(candidate.kit|| (matches[0]?fromCatalog(matches[0]):DEFAULT_KIT));
 let previousTeam=normalizeTeam(team.value);
 team.setAttribute('list','kit-team-names');
 const suggestions=document.createElement('datalist');suggestions.id='kit-team-names';suggestions.innerHTML=[...new Set(catalog.map(k=>k.team_name))].map(n=>`<option value="${esc(n)}"></option>`).join('');team.after(suggestions);
 function metadata(){
  const record=catalog.find(k=>k.id===kit.catalog_id);
  root.querySelector('.kit-caption').textContent=record?`${record.team_name} · ${record.season.replace('-','/')} · ${record.variant}`:'Divisa personalizzata · '+kit.season.replace('-','/');
  const source=root.querySelector('.kit-source');
  source.replaceChildren();
  if(record){const p=document.createElement('p');p.textContent=record.source_note;const a=document.createElement('a');a.textContent='Consulta la fonte storica ↗';a.href=record.source_url;a.target='_blank';a.rel='noopener noreferrer';source.append(p,a);}
  else{const p=document.createElement('p');p.textContent=matches.length?'Personalizzazione manuale: non presentata come divisa storica verificata.':'Squadra non ancora nel catalogo: scegli colori e motivo della divisa.';source.append(p);}
 }
 function paint(){root.querySelector('.kit-preview-art').innerHTML=kitFigure(kit,'editor');metadata();}
 function render(){
  root.innerHTML=`<div class="kit-designer"><div class="kit-preview"><p class="eyebrow">IL TUO OMINO</p><div class="kit-preview-art"></div><p class="kit-caption" aria-live="polite"></p></div><div class="kit-settings"><label>Divisa dal catalogo<select name="kit-choice"><option value="">Personalizzata</option>${matches.map(k=>`<option value="${esc(k.id)}" ${kit.catalog_id===k.id?'selected':''}>${esc(k.season.replace('-','/'))} · ${esc(k.variant)}</option>`).join('')}</select></label><div class="kit-fields"><label>Stagione<select name="kit-season">${Array.from({length:10},(_,i)=>{const s=`${1980+i}-${1981+i}`;return `<option value="${s}" ${kit.season===s?'selected':''}>${s.replace('-','/')}</option>`;}).join('')}</select></label><label>Variante<select name="kit-variant">${['casa','trasferta','coppa'].map(v=>`<option ${kit.variant===v?'selected':''} value="${v}">${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label><label class="kit-pattern">Motivo maglia<select name="kit-pattern">${Object.entries(PATTERNS).map(([v,t])=>`<option value="${v}" ${kit.pattern===v?'selected':''}>${t}</option>`).join('')}</select></label>${[['shirt','Maglia'],['accent','Dettagli / motivo'],['shorts','Pantaloncini'],['socks','Calzettoni']].map(([key,label])=>`<label class="kit-color">${label}<input name="kit-${key}" type="color" value="${kit[key]}" aria-label="Colore ${label.toLowerCase()}"></label>`).join('')}</div></div></div><div class="kit-source"></div>`;
  paint();
  root.querySelector('[name="kit-choice"]').onchange=e=>{const record=matches.find(k=>k.id===e.target.value);kit=record?fromCatalog(record):{...kit,catalog_id:null};render();};
  for(const field of root.querySelectorAll('.kit-fields input,.kit-fields select'))field.addEventListener('input',()=>{
    const input={...kit,catalog_id:null};for(const key of ['shirt','accent','shorts','socks','pattern','season','variant'])input[key]=form.elements[`kit-${key}`].value;
    kit=cleanKit(input);root.querySelector('[name="kit-choice"]').value='';paint();
  });
 }
 team.addEventListener('input',()=>{
  const next=normalizeTeam(team.value);if(next===previousTeam)return;previousTeam=next;
  matches=findTeamKits(team.value,catalog);kit=matches.length?fromCatalog(matches[0]):{...DEFAULT_KIT};render();
 });
 render();
 return {getKit:()=>cleanKit(kit)};
}

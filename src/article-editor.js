export function parseStandings(text){
  if(!text.trim())return [];
  const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
  if(lines.length>24)throw new Error('La classifica può contenere al massimo 24 squadre.');
  return lines.map((line,i)=>{
    const values=line.split(/[;\t]/).map(v=>v.trim());
    if(values.length!==9||!values[1]||values[1].length>100)throw new Error(`Riga ${i+1}: usa 9 colonne separate da punto e virgola o tabulazione.`);
    const row={team:values[1]};
    for(const [n,key] of ['position','team','points','played','won','drawn','lost','gf','ga'].entries()){
      if(key==='team')continue;if(!/^\d{1,3}$/.test(values[n]))throw new Error(`Riga ${i+1}: ${key} deve essere un numero intero positivo o zero.`);row[key]=Number(values[n]);
    }
    if(row.position!==i+1)throw new Error('Le posizioni devono essere consecutive, a partire da 1.');
    if(row.played!==row.won+row.drawn+row.lost)throw new Error(`Riga ${i+1}: le partite giocate non corrispondono a vittorie, pareggi e sconfitte.`);
    row.adjustment=0;return row;
  });
}
export function parseSources(text){
  if(!text.trim())return [];
  const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());if(lines.length>10)throw new Error('Inserisci al massimo 10 fonti.');
  return lines.map(line=>{
    const parts=line.split('|').map(s=>s.trim()),url=parts.length===1?parts[0]:parts[1];
    let u;try{u=new URL(url);}catch{throw new Error('Ogni fonte deve contenere un indirizzo HTTPS valido.');}
    if(u.protocol!=='https:'||u.username||u.password)throw new Error('Le fonti devono usare HTTPS senza credenziali.');
    const title=parts.length===1?u.hostname:parts[0];if(!title||title.length>150||u.href.length>1000)throw new Error('Titolo o indirizzo della fonte troppo lungo.');
    return {title,url:u.href};
  });
}
export function openArticleEditor({db,esc,onPublished}){
  const dialog=document.createElement('dialog');dialog.className='article-dialog';
  const draftKey='scb-article-draft-v1';let busy=false,prepared=null;
  dialog.innerHTML=`<form class="article-form"><p class="eyebrow">IL TACCUINO DEL CLUB</p><h2>Scrivi un articolo</h2><p class="muted">Racconta un campionato. Controlla l’anteprima e pubblica nell’archivio.</p><label>Titolo<input name="title" required minlength="5" maxlength="140" placeholder="Germania Est 1987/88: …"></label><div class="article-form-row"><label>Paese<input name="country" required minlength="2" maxlength="60" placeholder="Germania Est"></label><label>Stagione<input name="season" required pattern="19[0-9]{2}(/[0-9]{2,4})?" placeholder="1987/88"></label></div><label>Campionato <span class="muted">(facoltativo)</span><input name="league" maxlength="80" placeholder="DDR-Oberliga"></label><label>Sommario<textarea name="summary" required minlength="10" maxlength="350" rows="3" placeholder="Una breve introduzione da mostrare nell’archivio"></textarea></label><label>Testo dell’articolo<textarea name="body" required maxlength="15000" rows="10" placeholder="Scrivi o incolla qui il testo. Separa i paragrafi con una riga vuota."></textarea></label><details><summary>Commento, classifica e fonti</summary><label>Il commento del club<textarea name="comment" maxlength="3000" rows="3"></textarea></label><label>Regole dell’epoca<textarea name="rules" maxlength="1500" rows="2" placeholder="Per esempio: vittoria 2 punti, pareggio 1."></textarea></label><label>Classifica <span class="muted">(facoltativa)</span><textarea name="standings" maxlength="10000" rows="6" placeholder="1; Berliner FC Dynamo; 37; 26; 15; 7; 4; 59; 30"></textarea></label><p class="muted">Una squadra per riga: posizione; squadra; punti; giocate; vinte; pareggi; perse; gol fatti; gol subiti. Puoi anche incollare colonne separate da tabulazioni.</p><label>Fonti<textarea name="sources" maxlength="10000" rows="3" placeholder="RSSSF | https://www.rsssf.org/tablesd/ddr88.html"></textarea></label><p class="muted">Una fonte per riga: nome | indirizzo HTTPS. Va bene anche il solo indirizzo.</p></details><p id="article-error" role="alert"></p><section id="article-preview" class="article-preview" hidden></section><div class="dialog-actions"><button type="button" class="quiet" id="article-cancel">Chiudi</button><button type="button" class="quiet" id="article-preview-button">Anteprima</button><button type="submit" class="primary" id="article-publish" disabled>Pubblica articolo →</button></div><p class="muted">La bozza resta in questo browser. Gli articoli pubblicati sono visibili a chi ha il link del sito.</p></form>`;
  document.body.append(dialog);dialog.showModal();
  const form=dialog.querySelector('form'),error=dialog.querySelector('#article-error'),preview=dialog.querySelector('#article-preview'),publish=dialog.querySelector('#article-publish');
  try{const draft=JSON.parse(localStorage.getItem(draftKey));if(draft)for(const [k,v] of Object.entries(draft))if(form.elements.namedItem(k))form.elements.namedItem(k).value=v;}catch{}
  function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify(Object.fromEntries(new FormData(form))));}catch{}}
  form.oninput=()=>{prepared=null;publish.disabled=true;preview.hidden=true;saveDraft();};
  dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>dialog.remove();
  dialog.querySelector('#article-cancel').onclick=()=>{if(!busy){saveDraft();dialog.close();}};
  dialog.querySelector('#article-preview-button').onclick=()=>{
    error.textContent='';if(!form.reportValidity())return;
    try{
      const value=Object.fromEntries(new FormData(form));
      const paragraphs=value.body.trim().split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
      if(paragraphs.length>40||paragraphs.some(p=>p.length>6000))throw new Error('Dividi il testo in paragrafi più brevi, separati da una riga vuota.');
      prepared={title:value.title.trim(),country:value.country.trim(),season:value.season.trim(),league:value.league.trim(),summary:value.summary.trim(),paragraphs,comment:value.comment.trim(),rules:value.rules.trim(),standings:parseStandings(value.standings),sources:parseSources(value.sources)};
      if(!paragraphs.length)throw new Error('Scrivi il testo dell’articolo.');
      preview.innerHTML=`<p class="eyebrow">ANTEPRIMA</p><h3>${esc(prepared.title)}</h3><p><strong>${esc(prepared.country)} · ${esc(prepared.season)}</strong></p><p>${esc(prepared.summary)}</p>${paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${prepared.comment?`<h4>Il commento del club</h4><p>${esc(prepared.comment)}</p>`:''}${prepared.rules?`<h4>Le regole dell’epoca</h4><p>${esc(prepared.rules)}</p>`:''}${prepared.standings.length?`<h4>Classifica</h4><ol>${prepared.standings.map(r=>`<li>${esc(r.team)} — ${r.points} pt · ${r.played} G · ${r.won} V · ${r.drawn} N · ${r.lost} P · ${r.gf}:${r.ga}</li>`).join('')}</ol>`:''}${prepared.sources.length?`<h4>Fonti</h4>${prepared.sources.map(s=>`<p>${esc(s.title)} · ${esc(s.url)}</p>`).join('')}`:''}`;
      preview.hidden=false;publish.disabled=false;
    }catch(e){prepared=null;publish.disabled=true;error.textContent=e.message;}
  };
  form.onsubmit=async e=>{
    e.preventDefault();if(busy||!prepared)return;busy=true;dialog.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);error.textContent='Pubblicazione in corso…';
    try{const {data,error:failure}=await db.rpc('publish_historical_article',{article:prepared});if(failure)throw failure;localStorage.removeItem(draftKey);dialog.close();await onPublished(data);}
    catch(e){error.textContent=e.message||'Pubblicazione non riuscita. La bozza è conservata.';dialog.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false);}
    finally{busy=false;}
  };
}

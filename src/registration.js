export const names = ['Flavio','Rudy','Andrea','Bono','Grifo','Flanik','Begnozzi','Salvi','Carmelo','Omar','Leo','Giulio'];
export function initialCandidates() { return names.map((name,i)=>({id:`p${i+1}`,name,ranking:i+1,team:null,status:'pending',version:0,undecided:name==='Giulio'})); }
export function allocation(candidates) {
  const confirmed=candidates.filter(c=>c.status==='confirmed').sort((a,b)=>a.ranking-b.ranking);
  const size=confirmed.length===12?6:confirmed.length===11?5:null;
  const divisions=new Map(confirmed.map((p,i)=>[p.id,size===null?null:i<size?'A':'B']));
  const pending=candidates.filter(c=>c.status==='pending').length;
  return {confirmed,pending,declined:candidates.filter(c=>c.status==='declined').length,size,divisions,ready:size!==null&&pending===0};
}
export function validateTeam(team,candidates,id) {
  const cleaned=team.trim().replace(/\s+/g,' ');
  if(!cleaned||cleaned.length>60)throw new Error('Inserisci una squadra da 1 a 60 caratteri.');
  if(candidates.some(c=>c.id!==id&&c.team?.toLocaleLowerCase('it')===cleaned.toLocaleLowerCase('it')))throw new Error('Questa squadra è già assegnata a un altro giocatore.');
  return cleaned;
}

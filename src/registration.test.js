import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialCandidates,allocation,validateTeam} from './registration.js';
test('Nessuna conferma implicita: Giulio indeciso, tutti senza squadra',()=>{
  const cs=initialCandidates(),a=allocation(cs);assert.equal(cs.length,12);assert.equal(cs[11].name,'Giulio');assert.equal(cs[11].undecided,true);assert.equal(a.pending,12);assert.equal(a.size,null);assert.equal(a.ready,false);
});
test('11 confermati: Flanik resta in B; pending impedisce composizione pronta',()=>{
  const cs=initialCandidates();cs.slice(0,11).forEach((c,i)=>Object.assign(c,{status:'confirmed',team:`Team ${i}`}));
  let a=allocation(cs);assert.equal(a.size,5);assert.equal(a.divisions.get('p5'),'A');assert.equal(a.divisions.get('p6'),'B');assert.equal(a.ready,false);
  cs[11].status='declined';a=allocation(cs);assert.equal(a.ready,true);assert.equal(a.divisions.get('p12'),undefined);
});
test('12 confermati: Flanik sale in A e Giulio è in B',()=>{
  const cs=initialCandidates();cs.forEach(c=>c.status='confirmed');const a=allocation(cs.reverse());
  assert.equal(a.size,6);assert.equal(a.divisions.get('p6'),'A');assert.equal(a.divisions.get('p7'),'B');assert.equal(a.divisions.get('p12'),'B');assert.equal(a.ready,true);
});
test('Il ranking si applica ai partecipanti effettivi anche se rinuncia un altro',()=>{
  const cs=initialCandidates();cs.forEach(c=>c.status='confirmed');cs[0].status='declined';const a=allocation(cs);
  assert.equal(a.divisions.get('p1'),undefined);assert.equal(a.divisions.get('p6'),'A');assert.equal(a.size,5);
});
test('Squadre: normalizzazione, duplicati, revoca e nomi non validi',()=>{
  const cs=initialCandidates();assert.equal(validateTeam('  Real   Madrid ',cs,'p1'),'Real Madrid');
  cs[0].team='Real Madrid';assert.throws(()=>validateTeam(' real madrid ',cs,'p2'));
  assert.equal(validateTeam('Real Madrid',cs,'p1'),'Real Madrid');
  for(const s of ['   ','a'.repeat(61)])assert.throws(()=>validateTeam(s,cs,'p2'));
  cs[0].team=null;assert.equal(validateTeam('Real Madrid',cs,'p2'),'Real Madrid');
});

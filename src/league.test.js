import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures, standings, validScore, demoData } from './league.js';
for (const n of [5, 6]) test(`Calendario di ${n} giocatori: coppie, giornate e riposi`, () => {
  const ids = Array.from({ length: n }, (_, i) => String(i + 1)), ms = fixtures(ids, 'A');
  assert.equal(ms.length, n * (n - 1));
  assert.equal(new Set(ms.map(m => m.id)).size, ms.length);
  for (const a of ids) for (const b of ids.filter(x => x !== a)) assert.equal(ms.filter(m => m.home_id === a && m.away_id === b).length, 1);
  for (let round = 1; round <= 10; round++) {
    const active = ms.filter(m => m.round === round).flatMap(m => [m.home_id, m.away_id]);
    assert.equal(new Set(active).size, active.length); assert.equal(active.length, n === 5 ? 4 : 6);
  }
  for (const id of ids) { assert.equal(ms.filter(m => m.home_id === id).length, n - 1); assert.equal(ms.filter(m => m.away_id === id).length, n - 1); }
});
test('Classifica: vittoria, pareggio, zero e partite non giocate', () => {
  const players = [{id:'a',name:'A'}, {id:'b',name:'B'}, {id:'c',name:'C'}];
  const rows = standings(players, [{home_id:'a',away_id:'b',home_score:2,away_score:0},{home_id:'b',away_id:'c',home_score:0,away_score:0},{home_id:'a',away_id:'c',home_score:null,away_score:null}]);
  assert.deepEqual(rows.map(r => [r.id,r.points,r.played,r.gd]), [['a',3,1,2],['c',1,1,0],['b',1,2,-2]]);
});
test('Correzione e cancellazione non accumulano punti', () => {
  const {players,matches} = demoData(); const m = matches[0]; m.home_score=1; m.away_score=0;
  assert.equal(standings(players,matches).find(r=>r.id===m.home_id).points,3);
  m.away_score=2; assert.equal(standings(players,matches).find(r=>r.id===m.home_id).points,0);
  m.home_score=null; m.away_score=null; assert.equal(standings(players,matches).reduce((s,r)=>s+r.played,0),0);
});
test('Punteggi accettati solo interi 0–99', () => { for (const n of [-1,100,1.5,null,'2',NaN]) assert.equal(validScore(n),false); assert.equal(validScore(0),true); });

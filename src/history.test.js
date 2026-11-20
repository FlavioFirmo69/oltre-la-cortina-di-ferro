import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekSlot,extractTable,validateTable,TOPICS} from '../server/history.js';
import {authorized} from '../api/editorial-cron.js';
import {parseStandings,parseSources} from './article-editor.js';
test('manual editor validates pasted standings and source links',()=>{
  const [row]=parseStandings('1; Berliner FC Dynamo; 37; 26; 15; 7; 4; 59; 30');assert.equal(row.points,37);assert.equal(row.team,'Berliner FC Dynamo');
  assert.throws(()=>parseStandings('1; X; 37; 26; 15; 7; 5; 59; 30'),/partite/);
  assert.throws(()=>parseSources('Click | javascript:alert(1)'),/HTTPS/);
  assert.throws(()=>parseSources('https://user:secret@example.com'),/HTTPS/);
  assert.equal(parseSources('RSSSF | https://www.rsssf.org/tablesd/ddr88.html')[0].title,'RSSSF');assert.deepEqual(parseStandings(''),[]);
});
test('week uses Monday in Rome, including Sunday UTC and DST',()=>{
  assert.equal(weekSlot(new Date('2026-11-22T23:30:00Z')),'2026-11-23');
  assert.equal(weekSlot(new Date('2026-11-22T21:30:00Z')),'2026-11-16');
  assert.equal(weekSlot(new Date('2026-07-05T22:30:00Z')),'2026-07-06');
});
test('cron rejects anonymous requests and missing configuration',()=>{
  assert.equal(authorized(undefined,undefined),false);assert.equal(authorized('Bearer bad','good'),false);assert.equal(authorized('Bearer good','good'),true);
});
test('rejects incomplete and inconsistent historical tables',()=>{
  assert.throws(()=>extractTable('FINAL TABLE:\n1.Dynamo 30 18 10 2 49-23 46',TOPICS[1]),/Numero di squadre/);
  const rows=[{position:1,team:'A',played:2,won:2,drawn:0,lost:0,gf:4,ga:0,points:4,adjustment:0},{position:2,team:'B',played:2,won:0,drawn:0,lost:2,gf:0,ga:4,points:0,adjustment:0}];
  assert.equal(validateTable(rows,{teams:2}),true);
  assert.throws(()=>validateTable([{...rows[0],gf:5},rows[1]],{teams:2}),/Totali/);
  assert.throws(()=>validateTable([{...rows[0],adjustment:-1},rows[1]],{teams:2}),/Punteggio/);
});

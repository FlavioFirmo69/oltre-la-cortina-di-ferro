export function fixtures(ids, division, seasonId = 'season-1') {
  const ring = [...ids];
  if (ring.length % 2) ring.push(null);
  const first = [];
  for (let r = 0; r < ring.length - 1; r++) {
    for (let i = 0; i < ring.length / 2; i++) {
      let home = ring[i], away = ring[ring.length - 1 - i];
      if (r % 2) [home, away] = [away, home];
      if (home && away) first.push({ id: `${division}-${r + 1}-${i}`, season_id: seasonId, division, round: r + 1, home_id: home, away_id: away, home_score: null, away_score: null });
    }
    ring.splice(1, 0, ring.pop());
  }
  return [...first, ...first.map(m => ({ ...m, id: `${m.id}-r`, round: m.round + ring.length - 1, home_id: m.away_id, away_id: m.home_id }))];
}
export function validScore(value) { return Number.isInteger(value) && value >= 0 && value <= 99; }
export function standings(players, matches) {
  const rows = new Map(players.map(p => [p.id, { ...p, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]));
  for (const m of matches) {
    if (!validScore(m.home_score) || !validScore(m.away_score)) continue;
    const h = rows.get(m.home_id), a = rows.get(m.away_id);
    if (!h || !a) continue;
    h.played++; a.played++; h.gf += m.home_score; h.ga += m.away_score; a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score === m.away_score) { h.drawn++; a.drawn++; h.points++; a.points++; }
    else { const w = m.home_score > m.away_score ? h : a, l = w === h ? a : h; w.won++; w.points += 3; l.lost++; }
  }
  return [...rows.values()].map(r => ({ ...r, gd: r.gf - r.ga })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name, 'it'));
}
export function demoData() {
  const players = Array.from({ length: 11 }, (_, i) => ({ id: `p${i + 1}`, name: `Giocatore ${i + 1}`, division: i < 5 ? 'A' : 'B', season_id: 'season-1' }));
  return { players, matches: ['A', 'B'].flatMap(d => fixtures(players.filter(p => p.division === d).map(p => p.id), d)), season: { id: 'season-1', name: 'Stagione 1' } };
}

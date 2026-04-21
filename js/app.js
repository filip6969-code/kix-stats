'use strict';

// ── STATE ──────────────────────────────────────────────────────────────────
let pid = 0;
const state = {
  teams: { A: [], B: [] },
  data: {},
  quarter: '1Q',
  benchVisible: { A: false, B: false },
  addingTeam: null,
  detailMatch: null,
};

// ── STORAGE ────────────────────────────────────────────────────────────────
function saveHistory(match) {
  const history = loadHistory();
  history.unshift(match);
  localStorage.setItem('kix_history', JSON.stringify(history));
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('kix_history') || '[]'); }
  catch { return []; }
}
function saveDraft() {
  const draft = {
    teams: state.teams,
    data: state.data,
    quarter: state.quarter,
    matchTitle: document.getElementById('matchTitle').value,
    teamNameA: document.getElementById('teamNameA').value,
    teamNameB: document.getElementById('teamNameB').value,
  };
  localStorage.setItem('kix_draft', JSON.stringify(draft));
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem('kix_draft') || 'null');
    if (!d) return false;
    state.teams = d.teams;
    state.data = d.data;
    state.quarter = d.quarter;
    pid = Math.max(...Object.values(state.teams).flat().map(p => parseInt(p.id.slice(1)) + 1), 0);
    setTimeout(() => {
      document.getElementById('matchTitle').value = d.matchTitle || '';
      document.getElementById('teamNameA').value = d.teamNameA || '';
      document.getElementById('teamNameB').value = d.teamNameB || '';
      document.querySelectorAll('.q-btn').forEach(b => {
        b.classList.toggle('active', b.textContent === d.quarter);
      });
    }, 0);
    return true;
  } catch { return false; }
}

// ── PLAYER ────────────────────────────────────────────────────────────────
function mkPlayer(num, name, team) {
  const id = 'p' + (pid++);
  const p = { id, num, name, team, benched: false };
  state.data[id] = {
    shots2: { hit: 0, miss: 0 },
    shots3: { hit: 0, miss: 0 },
    shots1: { hit: 0, miss: 0 },
    def: { Ast: 0, Reb: 0, Stl: 0, Blk: 0 },
    fouls: 0,
  };
  return p;
}

// ── MODAL ─────────────────────────────────────────────────────────────────
function openAddModal(team) {
  state.addingTeam = team;
  document.getElementById('modalNum').value = '';
  document.getElementById('modalName').value = '';
  const btn = document.getElementById('modalConfirmBtn');
  btn.style.background = team === 'A' ? 'var(--a)' : 'var(--b)';
  document.getElementById('addModal').classList.add('open');
  setTimeout(() => document.getElementById('modalNum').focus(), 50);
}
function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}
function closeModal(e) {
  if (e.target === document.getElementById('addModal')) closeAddModal();
}
function confirmAddPlayer() {
  const num = document.getElementById('modalNum').value.trim();
  const name = document.getElementById('modalName').value.trim();
  if (!num) { document.getElementById('modalNum').focus(); return; }
  const p = mkPlayer(num, name, state.addingTeam);
  state.teams[state.addingTeam].push(p);
  closeAddModal();
  render();
  saveDraft();
}

// ── ACTIONS ───────────────────────────────────────────────────────────────
function addShot(id, type, result) {
  state.data[id]['shots' + type][result]++;
  renderCard(id);
  saveDraft();
}
function undoShot(id, type, result) {
  if (state.data[id]['shots' + type][result] > 0)
    state.data[id]['shots' + type][result]--;
  renderCard(id);
  saveDraft();
}
function addDef(id, key) {
  state.data[id].def[key]++;
  renderCard(id);
  saveDraft();
}
function undoDef(id, key) {
  if (state.data[id].def[key] > 0) state.data[id].def[key]--;
  renderCard(id);
  saveDraft();
}
function toggleFoul(id, idx) {
  const c = state.data[id].fouls;
  state.data[id].fouls = idx < c ? idx : idx + 1;
  renderCard(id);
  saveDraft();
}
function toggleBenchPlayer(id, team) {
  const p = state.teams[team].find(x => x.id === id);
  if (p) { p.benched = !p.benched; render(); saveDraft(); }
}
function updateName(id, val, team) {
  const p = state.teams[team].find(x => x.id === id);
  if (p) { p.name = val; saveDraft(); }
}
function setQ(el) {
  document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.quarter = el.textContent;
  saveDraft();
}
function toggleBench(team) {
  state.benchVisible[team] = !state.benchVisible[team];
  const el = document.getElementById('bench' + team);
  el.style.display = state.benchVisible[team] ? 'grid' : 'none';
  updateBenchBtn(team);
}

// ── RENDER ────────────────────────────────────────────────────────────────
function ticks(hit, miss) {
  let h = '';
  for (let i = 0; i < hit; i++) h += `<div class="tick hit">+</div>`;
  for (let i = 0; i < miss; i++) h += `<div class="tick miss">−</div>`;
  return h;
}

function buildCardHTML(p) {
  const d = state.data[p.id];
  const id = p.id;
  const t = p.team;
  const foulDots = Array.from({ length: 5 }, (_, i) =>
    `<div class="fdot ${i < d.fouls ? 'f' : ''}" onclick="toggleFoul('${id}',${i})"></div>`
  ).join('');
  const defKeys = ['Ast', 'Reb', 'Stl', 'Blk'];
  const defRows = defKeys.map(k => `
    <div class="def-row">
      <div class="def-key">${k}</div>
      <div class="def-count">${d.def[k]}</div>
      <div class="def-btns">
        <div class="smbtn h" onclick="addDef('${id}','${k}')">+</div>
        <div class="smbtn u" onclick="undoDef('${id}','${k}')">↩</div>
      </div>
    </div>`).join('');
  const shotTypes = [['2', '2pt'], ['3', '3pt'], ['1', '1pt']];
  const shotRows = shotTypes.map(([type, label]) => `
    <div class="shot-row">
      <div class="shot-type">${label}</div>
      <div class="shot-ticks">${ticks(d['shots' + type].hit, d['shots' + type].miss)}</div>
    </div>
    <div class="btn-row">
      <div class="smbtn h" onclick="addShot('${id}','${type}','hit')">+</div>
      <div class="smbtn m" onclick="addShot('${id}','${type}','miss')">−</div>
      <div class="smbtn u" onclick="undoShot('${id}','${type}','hit')">↩</div>
    </div>`).join('');

  const benchLabel = p.benched ? '→ Teren' : '→ Klupa';
  return `
    <div class="pcard-header">
      <div class="num-badge">#${p.num}</div>
      <input class="pname-input" placeholder="Ime..." value="${p.name}"
        onchange="updateName('${id}',this.value,'${t}')" />
      <div class="foul-col">
        <div class="foul-lbl">Faulovi</div>
        <div class="fdots">${foulDots}</div>
        <div class="bench-link" onclick="toggleBenchPlayer('${id}','${t}')">${benchLabel}</div>
      </div>
    </div>
    <div class="two-cols">
      <div class="col-block">
        <div class="col-title">Napad</div>
        ${shotRows}
      </div>
      <div class="col-block">
        <div class="col-title">Obrana</div>
        ${defRows}
      </div>
    </div>`;
}

function renderCard(id) {
  const el = document.querySelector(`[data-pid="${id}"]`);
  if (!el) { render(); return; }
  const p = [...state.teams.A, ...state.teams.B].find(x => x.id === id);
  if (!p) return;
  el.innerHTML = buildCardHTML(p);
}

function updateBenchBtn(team) {
  const bench = state.teams[team].filter(p => p.benched);
  const btn = document.getElementById('benchBtn' + team);
  if (!btn) return;
  if (bench.length === 0) { btn.textContent = ''; btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.textContent = state.benchVisible[team]
    ? `Sakrij klupu (${bench.length})`
    : `Klupa (${bench.length})`;
}

function render() {
  ['A', 'B'].forEach(t => {
    const active = state.teams[t].filter(p => !p.benched);
    const bench = state.teams[t].filter(p => p.benched);

    const gridEl = document.getElementById('grid' + t);
    const benchEl = document.getElementById('bench' + t);

    gridEl.innerHTML = '';
    active.forEach(p => {
      const card = document.createElement('div');
      card.className = `pcard team-${t.toLowerCase()}`;
      card.dataset.pid = p.id;
      card.innerHTML = buildCardHTML(p);
      gridEl.appendChild(card);
    });

    benchEl.innerHTML = '';
    bench.forEach(p => {
      const card = document.createElement('div');
      card.className = `pcard team-${t.toLowerCase()}`;
      card.dataset.pid = p.id;
      card.innerHTML = buildCardHTML(p);
      benchEl.appendChild(card);
    });

    document.getElementById('court' + t).textContent =
      active.length + ' na terenu';
    updateBenchBtn(t);
  });
}

// ── FINISH MATCH ──────────────────────────────────────────────────────────
function finishMatch() {
  if (!confirm('Završiti utakmicu i spremiti u povijest?')) return;
  const match = {
    id: Date.now(),
    title: document.getElementById('matchTitle').value || 'Utakmica bez naslova',
    teamNameA: document.getElementById('teamNameA').value || 'Tim A',
    teamNameB: document.getElementById('teamNameB').value || 'Tim B',
    date: new Date().toLocaleDateString('hr-HR'),
    quarter: state.quarter,
    teams: JSON.parse(JSON.stringify(state.teams)),
    data: JSON.parse(JSON.stringify(state.data)),
  };
  saveHistory(match);
  localStorage.removeItem('kix_draft');

  // reset
  state.teams = { A: [], B: [] };
  state.data = {};
  pid = 0;
  document.getElementById('matchTitle').value = '';
  document.getElementById('teamNameA').value = '';
  document.getElementById('teamNameB').value = '';
  render();
  renderHistory();
  showView('history');
  alert('Utakmica je spremljena u povijest!');
}

// ── HISTORY ───────────────────────────────────────────────────────────────
function renderHistory() {
  const list = document.getElementById('historyList');
  const history = loadHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="empty-history">Još nema završenih utakmica.</div>';
    return;
  }
  list.innerHTML = history.map(m => `
    <div class="history-card">
      <div>
        <div class="history-match-name">${m.title}</div>
        <div class="history-meta">${m.date} · ${m.teamNameA} vs ${m.teamNameB} · do ${m.quarter}</div>
      </div>
      <div class="history-actions">
        <button class="hist-btn" onclick="openDetail(${m.id})">Detalji</button>
        <button class="hist-btn pdf" onclick="exportPDF(${m.id})">PDF</button>
        <button class="hist-btn excel" onclick="exportCSV(${m.id})">Excel</button>
        <button class="hist-btn" style="color:var(--miss-text);" onclick="deleteMatch(${m.id})">Obriši</button>
      </div>
    </div>`).join('');
}

function deleteMatch(id) {
  if (!confirm('Obrisati ovu utakmicu?')) return;
  const history = loadHistory().filter(m => m.id !== id);
  localStorage.setItem('kix_history', JSON.stringify(history));
  renderHistory();
}

// ── DETAIL ────────────────────────────────────────────────────────────────
function calcStats(d) {
  const pts = d.shots2.hit * 2 + d.shots3.hit * 3 + d.shots1.hit;
  const fgA = d.shots2.hit + d.shots2.miss + d.shots3.hit + d.shots3.miss;
  const fgM = d.shots2.hit + d.shots3.hit;
  const fg = fgA > 0 ? Math.round(fgM / fgA * 100) + '%' : '-';
  const ftA = d.shots1.hit + d.shots1.miss;
  const ft = ftA > 0 ? Math.round(d.shots1.hit / ftA * 100) + '%' : '-';
  return { pts, fg, ft, ...d.def, fouls: d.fouls };
}

function teamTable(players, data, teamName) {
  const rows = players.map(p => {
    const d = data[p.id];
    if (!d) return '';
    const s = calcStats(d);
    const label = p.name ? `#${p.num} ${p.name}` : `#${p.num}`;
    return `<tr>
      <td>${label}</td>
      <td><b>${s.pts}</b></td>
      <td>${d.shots2.hit}/${d.shots2.hit + d.shots2.miss} <span style="color:var(--text-secondary)">${s.fg}</span></td>
      <td>${d.shots3.hit}/${d.shots3.hit + d.shots3.miss}</td>
      <td>${d.shots1.hit}/${d.shots1.hit + d.shots1.miss} <span style="color:var(--text-secondary)">${s.ft}</span></td>
      <td>${s.Ast}</td>
      <td>${s.Reb}</td>
      <td>${s.Stl}</td>
      <td>${s.Blk}</td>
      <td>${s.fouls}</td>
    </tr>`;
  }).join('');

  return `
    <div class="detail-team-title">${teamName}</div>
    <table class="detail-table">
      <thead><tr>
        <th>Igrač</th><th>Pts</th><th>2pt</th><th>3pt</th><th>1pt (SB)</th>
        <th>Ast</th><th>Reb</th><th>Stl</th><th>Blk</th><th>Faulovi</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function openDetail(id) {
  const m = loadHistory().find(x => x.id === id);
  if (!m) return;
  state.detailMatch = m;
  document.getElementById('detailTitle').textContent = m.title + ' — ' + m.date;
  const allPlayers = [...m.teams.A, ...m.teams.B];
  document.getElementById('detailContent').innerHTML =
    teamTable(m.teams.A, m.data, m.teamNameA) +
    teamTable(m.teams.B, m.data, m.teamNameB);
  document.getElementById('detailModal').classList.add('open');
}
function closeDetailModal(e) {
  if (!e || e.target === document.getElementById('detailModal')) {
    document.getElementById('detailModal').classList.remove('open');
  }
}

// ── EXPORT PDF ────────────────────────────────────────────────────────────
function buildPrintHTML(m) {
  const style = `
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px;}
    h1{font-size:16px;margin-bottom:4px;}
    h2{font-size:13px;margin:14px 0 6px;color:#185FA5;}
    table{border-collapse:collapse;width:100%;margin-bottom:12px;}
    th,td{border:1px solid #ccc;padding:4px 7px;text-align:left;}
    th{background:#f0f0ee;font-size:10px;}
  `;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${style}</style></head><body>
    <h1>${m.title}</h1>
    <p style="color:#666;font-size:10px;">${m.date} · ${m.teamNameA} vs ${m.teamNameB} · do ${m.quarter}</p>
    ${buildTeamPrintTable(m.teams.A, m.data, m.teamNameA)}
    ${buildTeamPrintTable(m.teams.B, m.data, m.teamNameB)}
  </body></html>`;
}

function buildTeamPrintTable(players, data, teamName) {
  const rows = players.map(p => {
    const d = data[p.id];
    if (!d) return '';
    const s = calcStats(d);
    const fgA = d.shots2.hit + d.shots2.miss + d.shots3.hit + d.shots3.miss;
    const fgM = d.shots2.hit + d.shots3.hit;
    const fg = fgA > 0 ? Math.round(fgM / fgA * 100) + '%' : '-';
    const ftA = d.shots1.hit + d.shots1.miss;
    const ft = ftA > 0 ? Math.round(d.shots1.hit / ftA * 100) + '%' : '-';
    return `<tr>
      <td>${p.name ? '#' + p.num + ' ' + p.name : '#' + p.num}</td>
      <td><b>${s.pts}</b></td>
      <td>${d.shots2.hit}/${d.shots2.hit + d.shots2.miss} (${fg})</td>
      <td>${d.shots3.hit}/${d.shots3.hit + d.shots3.miss}</td>
      <td>${d.shots1.hit}/${d.shots1.hit + d.shots1.miss} (${ft})</td>
      <td>${s.Ast}</td><td>${s.Reb}</td><td>${s.Stl}</td><td>${s.Blk}</td><td>${s.fouls}</td>
    </tr>`;
  }).join('');
  return `<h2>${teamName}</h2>
    <table><thead><tr>
      <th>Igrač</th><th>Pts</th><th>2pt</th><th>3pt</th><th>1pt (SB)</th>
      <th>Ast</th><th>Reb</th><th>Stl</th><th>Blk</th><th>Faulovi</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function exportPDF(id) {
  const m = loadHistory().find(x => x.id === id);
  if (!m) return;
  const win = window.open('', '_blank');
  win.document.write(buildPrintHTML(m));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
function exportDetailPDF() {
  if (state.detailMatch) exportPDF(state.detailMatch.id);
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────
function buildCSV(m) {
  const header = 'Tim,Igrač,Broj,Pts,2pt pogoci,2pt promašaji,3pt pogoci,3pt promašaji,1pt pogoci,1pt promašaji,Ast,Reb,Stl,Blk,Faulovi\n';
  const rows = ['A', 'B'].flatMap(t =>
    m.teams[t].map(p => {
      const d = m.data[p.id];
      if (!d) return '';
      const s = calcStats(d);
      return [
        t === 'A' ? m.teamNameA : m.teamNameB,
        p.name || '',
        p.num,
        s.pts,
        d.shots2.hit, d.shots2.miss,
        d.shots3.hit, d.shots3.miss,
        d.shots1.hit, d.shots1.miss,
        s.Ast, s.Reb, s.Stl, s.Blk, s.fouls
      ].join(',');
    })
  ).join('\n');
  return header + rows;
}

function exportCSV(id) {
  const m = loadHistory().find(x => x.id === id);
  if (!m) return;
  const csv = buildCSV(m);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (m.title || 'kix-stats') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
function exportDetailCSV() {
  if (state.detailMatch) exportCSV(state.detailMatch.id);
}

// ── VIEWS ─────────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && name === 'live') || (i === 1 && name === 'history'));
  });
  if (name === 'history') renderHistory();
}

// ── KEYBOARD SHORTCUT ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAddModal();
    closeDetailModal();
  }
  if (e.key === 'Enter' && document.getElementById('addModal').classList.contains('open')) {
    confirmAddPlayer();
  }
});

// ── INIT ──────────────────────────────────────────────────────────────────
document.getElementById('matchDate').textContent =
  new Date().toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' });

if (!loadDraft()) {
  // default demo players
  [7, 11, 4, 23, 5].forEach(n => state.teams.A.push(mkPlayer(String(n), '', 'A')));
  [8, 13, 6, 21, 3].forEach(n => state.teams.B.push(mkPlayer(String(n), '', 'B')));
}
render();

// ── SERVICE WORKER (PWA offline) ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

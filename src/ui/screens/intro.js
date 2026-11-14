// Title, scenario selection and mission briefing screens.
import { SCENARIOS, DIFFICULTIES } from '../../data/scenarios.js';
import { ROLES } from '../../data/catalog.js';
import { icon, ROLE_ICON } from '../icons.js';
import { esc, money } from '../util.js';
import { brandMark, topBar, concept, prefTools, roleMeta } from '../components.js';
import { leaderboard } from '../../state.js';
import { tx, loc } from '../../i18n.js';

export function renderTitle() {
  return `<div class="corner-tools">${prefTools()}</div>
  <main class="title-screen" id="main">
    <div class="title-sky" aria-hidden="true">
      <svg class="title-orbit" viewBox="0 0 600 600">
        <defs>
          <radialGradient id="tg-planet" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#3b7bd8"/><stop offset="55%" stop-color="#1a3f7a"/><stop offset="100%" stop-color="#081530"/>
          </radialGradient>
        </defs>
        <circle cx="300" cy="300" r="120" fill="url(#tg-planet)"/>
        <ellipse class="to-ring r1" cx="300" cy="300" rx="235" ry="78" transform="rotate(-22 300 300)"/>
        <ellipse class="to-ring r2" cx="300" cy="300" rx="190" ry="190"/>
        <ellipse class="to-ring r3" cx="300" cy="300" rx="275" ry="40" transform="rotate(12 300 300)"/>
        <g class="to-sat s1"><circle r="6" fill="var(--launch)"/></g>
        <g class="to-sat s2"><circle r="4.5" fill="var(--go)"/></g>
      </svg>
    </div>
    <div class="title-content">
      <p class="eyebrow">NASA Space Apps Challenge 2026 · ${tx('Space Mission Design Game', 'Game Desain Misi Antariksa')}</p>
      <h1 class="title-h1">${brandMark(56)}<span>GO/NO-GO</span></h1>
      <p class="title-tag">${tx('Every choice has a cost. Can your team still launch?', 'Setiap pilihan ada harganya. Masih bisakah timmu meluncur?')}</p>
      <ul class="title-points">
        <li>${icon('satellite', { size: 20 })}<span>${tx('<strong>Design a real mission.</strong> Pick instruments, orbit, rocket, power, radios and a ground team.',
          '<strong>Rancang misi sungguhan.</strong> Pilih instrumen, orbit, roket, daya, radio, dan tim darat.')}</span></li>
        <li>${icon('gauge', { size: 20 })}<span>${tx('<strong>See every trade-off live.</strong> Mass, power, budget, data, comms, time and delta-v react to each choice.',
          '<strong>Lihat setiap trade-off secara langsung.</strong> Massa, daya, anggaran, data, komunikasi, waktu, dan delta-v berubah di setiap pilihan.')}</span></li>
        <li>${icon('rocket', { size: 20 })}<span>${tx('<strong>Fly it.</strong> Survive solar storms and space debris, then learn exactly why your mission worked, or didn\'t.',
          '<strong>Terbangkan.</strong> Hadapi badai Matahari dan sampah antariksa, lalu pelajari kenapa misimu berhasil atau gagal.')}</span></li>
      </ul>
      <div class="title-cta">
        <button type="button" class="btn btn-primary btn-lg" data-action="go" data-screen="scenarios" data-focus="start">${icon('play')}<span>${tx('Start a mission', 'Mulai misi')}</span></button>
        <button type="button" class="btn btn-secondary btn-lg" data-action="howto">${icon('info')}<span>${tx('How to play', 'Cara bermain')}</span></button>
        <button type="button" class="btn btn-ghost btn-lg" data-action="about">${icon('book')}<span>${tx('About & NASA sources', 'Tentang & sumber NASA')}</span></button>
      </div>
      <p class="title-foot">${tx('Play solo, or as a team of up to four, each owning one of NASA\'s four mission segments.',
        'Main sendiri, atau sebagai tim hingga empat orang, masing-masing memegang satu dari empat segmen misi NASA.')}</p>
    </div>
  </main>`;
}

export function renderScenarios(state) {
  const cards = SCENARIOS.map((s) => {
    const best = s.priorities.map((p) => leaderboard(s.id, p.id)[0]).filter(Boolean).sort((a, b) => b.score - a.score)[0];
    return `<button type="button" class="scenario-card" style="--accent:${s.accent}" data-action="pick-scenario" data-id="${s.id}" data-focus="sc-${s.id}">
      <span class="sc-patch">${icon(s.icon, { size: 34 })}</span>
      <span class="sc-kind">${esc(loc(s, 'kind'))} · ${esc(loc(s, 'where'))}</span>
      <span class="sc-name">${esc(s.name)}</span>
      <span class="sc-tag">${esc(loc(s, 'tagline'))}</span>
      <span class="sc-meta"><span>${icon('coins', { size: 14 })} ${tx('Budget', 'Anggaran')} ${money(s.budget)}</span><span>${icon('flag', { size: 14 })} ${tx(`${s.priorities.length} mission priorities`, `${s.priorities.length} prioritas misi`)}</span></span>
      ${best ? `<span class="sc-best">${icon('trophy', { size: 14 })} ${tx('Best here', 'Terbaik')}: ${best.score} (${esc(best.grade)})</span>` : ''}
    </button>`;
  }).join('');
  return `<header class="topbar topbar-simple">
      <button class="brand" type="button" data-action="home" aria-label="${tx('GO/NO-GO home', 'Beranda GO/NO-GO')}">${brandMark(26)}<span class="brand-name">GO/NO-GO</span></button>
      <div class="tb-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="codex">${icon('book')}<span>Codex</span></button>
        ${prefTools()}
      </div>
    </header>
    <main class="page" id="main">
      <div class="page-head">
        <p class="eyebrow">${tx('Step 1 · Mission objective', 'Langkah 1 · Tujuan misi')}</p>
        <h1>${tx('Choose a mission', 'Pilih misi')}</h1>
        <p class="lede">${tx('Every mission starts with a question someone needs answered. Pick the problem your team will solve.',
          'Setiap misi dimulai dari pertanyaan yang perlu dijawab. Pilih masalah yang akan dipecahkan timmu.')}</p>
      </div>
      <div class="scenario-grid">${cards}</div>
    </main>`;
}

export function renderBriefing(state, ctx) {
  const s = ctx.scenario;
  const prio = s.priorities.map((p) => {
    const sel = ctx.priority.id === p.id;
    const labels = loc(p, 'reqs');
    return `<button type="button" class="choice ${sel ? 'is-selected' : ''}" aria-pressed="${sel}" data-action="priority" data-id="${p.id}" data-focus="pr-${p.id}">
      <span class="choice-top"><span class="choice-name">${esc(loc(p, 'name'))}</span><span class="opt-check">${icon('check', { size: 14 })}</span></span>
      <span class="choice-desc">${esc(loc(p, 'desc'))}</span>
      <ul class="choice-reqs">${p.reqs.map((r, i) => `<li>${icon('check', { size: 12 })}${esc(typeof labels?.[i] === 'string' ? labels[i] : r.label)}</li>`).join('')}</ul>
    </button>`;
  }).join('');

  const diffs = DIFFICULTIES.map((d) => {
    const sel = state.difficultyId === d.id;
    return `<button type="button" class="choice choice-sm ${sel ? 'is-selected' : ''}" aria-pressed="${sel}" data-action="difficulty" data-id="${d.id}" data-focus="df-${d.id}">
      <span class="choice-top"><span class="choice-name">${esc(loc(d, 'name'))}${d.hints ? ` <span class="badge badge-suggest">${tx('Beginner', 'Pemula')}</span>` : ''}</span><span class="opt-check">${icon('check', { size: 14 })}</span></span>
      <span class="choice-desc">${esc(loc(d, 'blurb'))}</span>
      <span class="choice-meta">${tx('Budget', 'Anggaran')} ${money(s.budget * d.budgetMult)}</span>
    </button>`;
  }).join('');

  const team = state.mode === 'team';
  const players = Array.from({ length: state.playerCount }, (_, i) => `
    <label class="field"><span class="field-l">${tx('Player', 'Pemain')} ${i + 1}</span>
      <input type="text" maxlength="24" value="${esc(state.players[i])}" placeholder="${tx('Name', 'Nama')}" data-action="player-name" data-index="${i}" data-focus="player-${i}" autocomplete="off" /></label>`).join('');
  const assign = ROLES.map((role) => {
    const r = roleMeta(role.id);
    return `
    <label class="field field-role"><span class="field-l">${icon(ROLE_ICON[r.id], { size: 14 })} ${esc(r.title)} <span class="muted">(${esc(r.segment)})</span></span>
      <select data-action="assign" data-role="${r.id}" data-focus="assign-${r.id}">
        ${Array.from({ length: state.playerCount }, (_, i) => `<option value="${i}" ${state.roleAssign[r.id] === i ? 'selected' : ''}>${esc(state.players[i] || `${tx('Player', 'Pemain')} ${i + 1}`)}</option>`).join('')}
      </select></label>`;
  }).join('');

  return `${topBar(state, ctx, 'briefing')}
  <main class="page briefing" id="main">
    <div class="brief-hero" style="--accent:${s.accent}">
      <span class="sc-patch big">${icon(s.icon, { size: 44 })}</span>
      <div>
        <p class="eyebrow">${esc(loc(s, 'kind'))} · ${esc(loc(s, 'where'))}</p>
        <h1>${esc(s.name)}</h1>
        <p class="lede">${esc(loc(s, 'brief'))}</p>
        <p class="brief-users">${icon('users', { size: 16 })}<span><strong>${tx('Who needs it:', 'Siapa yang membutuhkan:')}</strong> ${esc(loc(s, 'users'))}</span></p>
      </div>
    </div>

    <section class="brief-step">
      <h2><span class="step-badge">1</span> ${tx('Set the mission priority', 'Tentukan prioritas misi')}</h2>
      <p class="muted">${tx('Your priority turns the objective into measurable requirements.', 'Prioritasmu mengubah tujuan menjadi requirement yang bisa diukur.')} ${concept('requirements', tx('What is a requirement?', 'Apa itu requirement?'))}</p>
      <div class="choice-grid">${prio}</div>
    </section>

    <section class="brief-step">
      <h2><span class="step-badge">2</span> ${tx('Who is flying?', 'Siapa yang menerbangkan?')}</h2>
      <div class="seg" role="group" aria-label="${tx('Play mode', 'Mode bermain')}">
        <button type="button" class="seg-btn ${!team ? 'is-on' : ''}" aria-pressed="${!team}" data-action="mode" data-id="solo" data-focus="mode-solo">${icon('user')}<span>${tx('Solo: you lead all four roles', 'Solo: kamu memimpin keempat peran')}</span></button>
        <button type="button" class="seg-btn ${team ? 'is-on' : ''}" aria-pressed="${team}" data-action="mode" data-id="team" data-focus="mode-team">${icon('users')}<span>${tx('Team: 2 to 4 players', 'Tim: 2 sampai 4 pemain')}</span></button>
      </div>
      ${team ? `<div class="team-setup">
        <div class="team-row">
          <label class="field"><span class="field-l">${tx('Team name', 'Nama tim')}</span><input type="text" maxlength="28" value="${esc(state.teamName)}" placeholder="${tx('e.g. Orbit Rangers', 'mis. Orbit Rangers')}" data-action="team-name" data-focus="team-name" autocomplete="off" /></label>
          <label class="field"><span class="field-l">${tx('Players', 'Pemain')}</span>
            <select data-action="player-count" data-focus="player-count">${[2, 3, 4].map((n) => `<option value="${n}" ${state.playerCount === n ? 'selected' : ''}>${tx(`${n} players`, `${n} pemain`)}</option>`).join('')}</select></label>
        </div>
        <div class="players">${players}</div>
        <p class="muted small">${tx('Each role matches one of NASA\'s four mission segments. Players with two roles switch tabs. Pass the device (or share your screen) and negotiate: the budget is shared, and each role has its own goal.',
          'Setiap peran sesuai dengan satu dari empat segmen misi NASA. Pemain yang memegang dua peran berpindah tab. Bergantian memakai perangkat (atau bagikan layar) dan bernegosiasilah: anggarannya dipakai bersama, dan setiap peran punya targetnya sendiri.')} ${concept('segments', tx('The four segments', 'Empat segmen'))}</p>
        <div class="assign">${assign}</div>
      </div>` : ''}
    </section>

    <section class="brief-step">
      <h2><span class="step-badge">3</span> ${tx('Difficulty', 'Tingkat kesulitan')}</h2>
      <div class="choice-grid choice-grid-3">${diffs}</div>
    </section>

    <div class="brief-cta">
      <label class="check"><input type="checkbox" data-action="use-starter" ${state.useStarter ? 'checked' : ''} data-focus="use-starter" />
        <span>${tx('Start from a starter design', 'Mulai dari desain awal')} <span class="muted">${tx('(it works, but has flaws to find and fix)', '(bisa terbang, tapi ada kelemahan untuk ditemukan dan diperbaiki)')}</span></span></label>
      <button type="button" class="btn btn-primary btn-lg" data-action="enter-design" data-focus="enter-design">${icon('right')}<span>${tx('Enter the design room', 'Masuk ruang desain')}</span></button>
    </div>
  </main>`;
}

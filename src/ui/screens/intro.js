// Title, scenario selection and mission briefing screens.
import { SCENARIOS, DIFFICULTIES } from '../../data/scenarios.js';
import { ROLES } from '../../data/catalog.js';
import { icon, ROLE_ICON } from '../icons.js';
import { esc, money } from '../util.js';
import { brandMark, topBar, concept, prefTools, roleMeta, statusPill } from '../components.js';
import { leaderboard } from '../../state.js';
import { tx, loc } from '../../i18n.js';

export function renderTitle() {
  const station = (id, status, note) => {
    const r = roleMeta(id);
    return `<li>${icon(ROLE_ICON[id], { size: 18 })}<span class="lp-who"><strong>${esc(r.title)}</strong><span>${esc(note ?? r.segment)}</span></span>${statusPill(status)}</li>`;
  };
  const steps = [
    [tx('Brief', 'Brief'), tx('Choose a mission and a priority. The priority sets measurable requirements.', 'Pilih misi dan prioritas. Prioritas menentukan requirement yang bisa diukur.')],
    [tx('Design', 'Desain'), tx('Four stations pick instruments, orbit, rocket, power and radios. Every choice moves mass, power, budget and data.', 'Empat stasiun memilih instrumen, orbit, roket, daya, dan radio. Setiap pilihan menggeser massa, daya, anggaran, dan data.')],
    ['Go/No-Go', tx('Each station reports GO, CAUTION or NO-GO. In team mode every lead votes.', 'Setiap stasiun melapor GO, WASPADA, atau NO-GO. Dalam mode tim, setiap pimpinan memberi suara.')],
    [tx('Flight', 'Terbang'), tx('Launch, reach orbit, and make calls when storms, debris and failures happen.', 'Luncurkan, capai orbit, dan ambil keputusan saat badai, sampah antariksa, dan kerusakan terjadi.')],
    [tx('Report', 'Laporan'), tx('See the score, the cause of every problem, real NASA data for your target, and similar real missions.', 'Lihat skor, penyebab setiap masalah, data NASA asli untuk targetmu, dan misi nyata yang mirip.')],
  ];
  const decides = {
    science: [tx('Instruments', 'Instrumen'), tx('Resolution and revisit', 'Resolusi dan kunjungan ulang'), tx('Science return', 'Hasil sains')],
    launch: [tx('Orbit and inclination', 'Orbit dan inklinasi'), tx('Number of spacecraft', 'Jumlah wahana'), tx('Launch vehicle', 'Roket peluncur')],
    spacecraft: [tx('Bus, solar arrays, battery', 'Bus, panel surya, baterai'), tx('Attitude control', 'Kendali sikap'), tx('Propulsion and delta-v', 'Propulsi dan delta-v')],
    ground: [tx('Radio band', 'Pita radio'), tx('Ground stations or the DSN', 'Stasiun bumi atau DSN'), tx('Operations team', 'Tim operasi')],
  };
  const roles = ['science', 'launch', 'spacecraft', 'ground'].map((id, i) => {
    const r = roleMeta(id);
    return `<div class="lp-role">
      <p class="lp-seg">${icon(ROLE_ICON[id], { size: 14 })} ${tx('Station', 'Stasiun')} ${i + 1} · ${esc(r.segment)}</p>
      <h3>${esc(r.title)}</h3>
      <p>${esc(r.blurb)}</p>
      <ul>${decides[id].map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>`;
  }).join('');
  const data = [
    [tx('Earth globe', 'Bola Bumi'), 'Blue Marble · NASA GIBS'],
    [tx('East Java from orbit', 'Jawa Timur dari orbit'), 'Aqua MODIS · GIBS / Worldview'],
    [tx('Indonesia at night', 'Indonesia di malam hari'), 'Black Marble (VIIRS) · GIBS'],
    [tx('Today\'s Sun', 'Matahari hari ini'), tx('SDO AIA 193 Å, live', 'SDO AIA 193 Å, langsung')],
    [tx('Moon map', 'Peta Bulan'), 'SVS CGI Moon Kit (LRO)'],
  ];
  const models = [
    [tx('Orbital period, eclipse length', 'Periode orbit, lama gerhana'), tx('Kepler\'s third law', 'Hukum Kepler ketiga')],
    [tx('Solar array and battery sizing', 'Ukuran panel surya dan baterai'), 'SMAD'],
    [tx('Delta-v and propellant', 'Delta-v dan propelan'), 'Tsiolkovsky'],
    [tx('Battery wear', 'Keausan baterai'), tx('Li-ion cycle life', 'Umur siklus Li-ion')],
    [tx('Swath and revisit', 'Sapuan dan kunjungan ulang'), tx('Ground-track geometry', 'Geometri lintasan')],
  ];
  const list = (rows) => `<ul class="lp-list">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><span class="src">${esc(v)}</span></li>`).join('')}</ul>`;

  return `<div class="lp">
    <header class="lp-bar">
      <span class="lp-brand">${brandMark(26)}<span class="brand-name">GO/NO-GO</span></span>
      ${prefTools()}
    </header>

    <main id="main">
      <section class="lp-hero">
        <div>
          <p class="lp-event">NASA Space Apps Challenge 2026 · Surabaya</p>
          <h1 class="lp-title">GO/NO-GO</h1>
          <p class="lp-sub">${tx('A space mission design game for one to four players.', 'Game desain misi antariksa untuk satu sampai empat pemain.')}</p>
          <p class="lp-body">${tx(
    'Pick a real problem: watch Semeru for eruptions, link remote islands, find ice on the Moon, or warn Earth of solar storms. Design the spacecraft, hold the launch poll, fly the mission, then read exactly why it worked or failed.',
    'Pilih masalah nyata: memantau erupsi Semeru, menghubungkan pulau terpencil, mencari es di Bulan, atau memperingatkan Bumi akan badai Matahari. Rancang wahananya, gelar poll peluncuran, terbangkan misinya, lalu baca dengan jelas kenapa misi itu berhasil atau gagal.')}</p>
          <div class="lp-cta">
            <button type="button" class="btn btn-primary btn-lg" data-action="go" data-screen="scenarios" data-focus="start">${icon('play')}<span>${tx('Start a mission', 'Mulai misi')}</span></button>
            <button type="button" class="btn btn-secondary btn-lg" data-action="howto">${icon('info')}<span>${tx('How to play', 'Cara bermain')}</span></button>
            <button type="button" class="lp-link" data-action="about">${tx('About & NASA sources', 'Tentang & sumber NASA')}</button>
          </div>
        </div>
        <figure class="lp-panel" aria-label="${tx('Example of a launch poll', 'Contoh poll peluncuran')}">
          <div class="lp-panel-h"><span>${tx('Launch poll', 'Poll peluncuran')}</span><span>Semeru Watch · T−10 ${tx('min', 'mnt')}</span></div>
          <ol class="lp-poll">
            ${station('science', 'go')}
            ${station('launch', 'go')}
            ${station('spacecraft', 'caution', tx('Power margin 6%, below the 10% minimum', 'Margin daya 6%, di bawah batas 10%'))}
            ${station('ground', 'go')}
          </ol>
          <figcaption class="lp-panel-f">${tx('Every station reports before launch. You can override a caution, and the flight will show what it cost.',
    'Setiap stasiun melapor sebelum peluncuran. Kamu boleh mengabaikan peringatan, dan penerbangan akan menunjukkan akibatnya.')}</figcaption>
        </figure>
      </section>

      <section class="lp-sec" aria-labelledby="lp-steps-h">
        <div class="lp-sec-h">
          <h2 id="lp-steps-h">${tx('How a mission runs', 'Alur satu misi')}</h2>
          <p>${tx('The same arc NASA teams follow, from a question to a flown mission. One round takes about fifteen minutes.',
    'Alur yang sama dengan tim NASA, dari sebuah pertanyaan hingga misi yang terbang. Satu ronde sekitar lima belas menit.')}</p>
        </div>
        <ol class="lp-steps">${steps.map(([h, p], i) => `<li><span class="lp-n">0${i + 1}</span><strong>${esc(h)}</strong><p>${esc(p)}</p></li>`).join('')}</ol>
      </section>

      <section class="lp-sec" aria-labelledby="lp-roles-h">
        <div class="lp-sec-h">
          <h2 id="lp-roles-h">${tx('Four stations, one budget', 'Empat stasiun, satu anggaran')}</h2>
          <p>${tx('NASA describes a science mission as four segments. Here each one is a role with its own goal, and all four share one budget.',
    'NASA membagi misi sains menjadi empat segmen. Di sini masing-masing menjadi peran dengan target sendiri, dan keempatnya berbagi satu anggaran.')}</p>
        </div>
        <div class="lp-roles">${roles}</div>
      </section>

      <section class="lp-sec" aria-labelledby="lp-data-h">
        <div class="lp-sec-h">
          <h2 id="lp-data-h">${tx('Data and models', 'Data dan model')}</h2>
          <p>${tx('Open NASA data and textbook formulas, simplified so a round takes minutes instead of months.',
    'Data terbuka NASA dan rumus buku teks, disederhanakan agar satu ronde cukup beberapa menit, bukan berbulan-bulan.')}</p>
        </div>
        <div class="lp-cols">
          <div><h3>${tx('NASA data in the game', 'Data NASA di dalam game')}</h3>${list(data)}</div>
          <div><h3>${tx('Models', 'Model')}</h3>${list(models)}</div>
        </div>
        <p class="lp-note">${tx('Component numbers are rounded game values that keep real-world proportions. They are not engineering data.',
    'Angka komponen adalah nilai game yang dibulatkan dengan proporsi dunia nyata, bukan data rekayasa.')}</p>
      </section>

      <footer class="lp-foot">
        <span>${tx('Prototype for NASA Space Apps Challenge 2026, Surabaya. Not an official NASA product.', 'Prototipe untuk NASA Space Apps Challenge 2026, Surabaya. Bukan produk resmi NASA.')}</span>
        <nav aria-label="${tx('More', 'Lainnya')}">
          <button type="button" class="btn btn-ghost btn-sm" data-action="howto">${tx('How to play', 'Cara bermain')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="about">${tx('NASA sources', 'Sumber NASA')}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="codex">Codex</button>
        </nav>
      </footer>
    </main>
  </div>`;
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

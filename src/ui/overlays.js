// Codex drawer, help/about dialogs and toasts.
import { CODEX_ORDER, codexEntry } from '../data/codex.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { tx } from '../i18n.js';

const drawerRoot = () => document.getElementById('drawer-root');
const modalRoot = () => document.getElementById('modal-root');
let returnFocus = null;

export function openCodex(id = null) {
  returnFocus = document.activeElement;
  const entries = CODEX_ORDER.map((key) => {
    const c = codexEntry(key);
    return `<details class="codex-entry" id="codex-${key}" ${key === id ? 'open' : ''}>
      <summary><span>${esc(c.title)}</span>${icon('down', { size: 14 })}</summary>
      <p>${esc(c.body)}</p>
      <p class="codex-game"><strong>${tx('In the game:', 'Di dalam game:')}</strong> ${esc(c.game)}</p>
      ${c.real ? `<p class="codex-real"><strong>${tx('For real:', 'Di dunia nyata:')}</strong> ${esc(c.real)}</p>` : ''}
    </details>`;
  }).join('');
  drawerRoot().innerHTML = `<div class="backdrop" data-close></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="codex-title">
      <header class="drawer-head">
        <h2 id="codex-title">${icon('book')} ${tx('Mission Codex', 'Codex Misi')}</h2>
        <button type="button" class="btn btn-icon" data-close aria-label="${tx('Close codex', 'Tutup codex')}">${icon('close')}</button>
      </header>
      <p class="drawer-intro muted">${tx('Plain-language explanations of every concept in the game, and how each one is modeled.', 'Penjelasan sederhana untuk setiap konsep di game ini, dan bagaimana masing-masing dimodelkan.')}</p>
      <div class="drawer-body">${entries}</div>
    </aside>`;
  const root = drawerRoot();
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeOverlays));
  const target = id ? root.querySelector(`#codex-${CSS.escape(id)}`) : null;
  if (target) {
    target.scrollIntoView({ block: 'start' });
    target.querySelector('summary').focus();
  } else {
    root.querySelector('.drawer [data-close]').focus();
  }
}

function dialog(title, bodyHtml, labelId) {
  returnFocus = document.activeElement;
  modalRoot().innerHTML = `<div class="backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${labelId}">
      <header class="drawer-head"><h2 id="${labelId}">${title}</h2>
        <button type="button" class="btn btn-icon" data-close aria-label="${tx('Close', 'Tutup')}">${icon('close')}</button></header>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  modalRoot().querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeOverlays));
  modalRoot().querySelector('.modal [data-close]').focus();
}

export function openHowTo({ canTour = false, onTour = null } = {}) {
  const steps = [
    tx('<strong>Choose a mission and a priority.</strong> The priority turns the objective into measurable requirements, like real mission teams do.',
      '<strong>Pilih misi dan prioritas.</strong> Prioritas mengubah tujuan menjadi requirement yang bisa diukur, seperti yang dilakukan tim misi sungguhan.'),
    tx('<strong>Design in four roles.</strong> Science picks instruments, Orbit & Launch picks the orbit, fleet and rocket, Spacecraft builds the bus, and Ground & Comms gets the data home.',
      '<strong>Desain dalam empat peran.</strong> Sains memilih instrumen, Orbit & Peluncuran memilih orbit, armada, dan roket, Wahana membangun bus, dan Darat & Komunikasi membawa data pulang.'),
    tx('<strong>Hover before you click.</strong> Every option previews how it shifts mass, power, budget, data, comms, time and delta-v on the dashboard.',
      '<strong>Arahkan kursor sebelum mengklik.</strong> Setiap pilihan menampilkan dampaknya pada massa, daya, anggaran, data, komunikasi, waktu, dan delta-v di dasbor.'),
    tx('<strong>Read the Flight Director\'s notes.</strong> Each problem explains why it happens and what to try. Open the Codex for any concept.',
      '<strong>Baca catatan Flight Director.</strong> Setiap masalah menjelaskan penyebabnya dan apa yang bisa dicoba. Buka Codex untuk konsep apa pun.'),
    tx('<strong>Call the Go/No-Go poll.</strong> In team mode, every lead must say GO. Solo, you can override a NO-GO, but it costs points.',
      '<strong>Mulai poll Go/No-Go.</strong> Dalam mode tim, setiap pimpinan harus menyatakan GO. Saat solo, kamu bisa mengabaikan NO-GO, tapi poinmu berkurang.'),
    tx('<strong>Fly the mission.</strong> Make calls when storms, debris and glitches happen.',
      '<strong>Terbangkan misinya.</strong> Ambil keputusan saat badai, sampah antariksa, dan gangguan terjadi.'),
    tx('<strong>Learn and fly again.</strong> The report explains what went right and wrong, shows real NASA data and similar real missions. There is never just one right design.',
      '<strong>Belajar dan terbang lagi.</strong> Laporan menjelaskan apa yang berhasil dan gagal, menampilkan data NASA asli dan misi nyata yang mirip. Tidak pernah hanya ada satu desain yang benar.'),
  ];
  dialog(`${icon('info')} ${tx('How to play', 'Cara bermain')}`, `
    <ol class="howto">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <p class="muted small">${tx('New to space engineering? Pick <strong>Cadet</strong> difficulty: good options are marked "Suggested". You can also tick "Start from a starter design" in the briefing.',
      'Baru mengenal teknik antariksa? Pilih tingkat <strong>Kadet</strong>: pilihan yang baik ditandai "Disarankan". Kamu juga bisa mencentang "Mulai dari desain awal" di briefing.')}</p>
    ${canTour ? `<button type="button" class="btn btn-primary" data-start-tour>${icon('compass')}<span>${tx('Start the guided tour', 'Mulai tur terpandu')}</span></button>` : ''}`, 'howto-title');
  modalRoot().querySelector('[data-start-tour]')?.addEventListener('click', () => {
    closeOverlays();
    onTour?.();
  });
}

export function openAbout() {
  dialog(`${icon('book')} ${tx('About GO/NO-GO', 'Tentang GO/NO-GO')}`, `
    <p>${tx('GO/NO-GO is a prototype built for the <strong>NASA Space Apps Challenge 2026</strong> challenge "Space Mission Design Game". It lets students experience how a complete mission is designed, from objective and requirements to launch, operations and post-mission analysis.',
      'GO/NO-GO adalah prototipe untuk tantangan <strong>NASA Space Apps Challenge 2026</strong> "Space Mission Design Game". Pelajar bisa merasakan bagaimana sebuah misi lengkap dirancang, dari tujuan dan requirement hingga peluncuran, operasi, dan analisis pascamisi.')}</p>
    <h3>${tx('How NASA resources shaped the game', 'Bagaimana sumber NASA membentuk game ini')}</h3>
    <ul class="about-list">
      <li><strong>Design and Develop Science Missions</strong> (NASA): ${tx('the four mission segments (launch, space, ground, user) became the four player roles.', 'empat segmen misi (peluncuran, antariksa, darat, pengguna) menjadi empat peran pemain.')}</li>
      <li><strong>Concept Maturity Levels</strong> (NASA JPL): ${tx('the flow from objective to requirements, trade studies and a point design reviewed at Go/No-Go.', 'alur dari tujuan ke requirement, studi trade-off, dan desain titik yang ditinjau di Go/No-Go.')}</li>
      <li><strong>Mission Design Lab</strong> (NASA Goddard): ${tx('the subsystem list (power, propulsion, attitude control, comms, cost, risk) and the live trade-study approach.', 'daftar subsistem (daya, propulsi, kendali sikap, komunikasi, biaya, risiko) dan pendekatan studi trade-off langsung.')}</li>
      <li><strong>General Mission Analysis Tool (GMAT)</strong>: ${tx('orbit periods and eclipse lengths use the same Kepler physics. The values are simplified for play.', 'periode orbit dan lama gerhana memakai fisika Kepler yang sama. Nilainya disederhanakan untuk permainan.')}</li>
      <li><strong>CubeSat 101</strong> (NASA CSLI): ${tx('CubeSat bus sizes, rideshare launches and the risks of small missions.', 'ukuran bus CubeSat, peluncuran rideshare, dan risiko misi kecil.')}</li>
      <li><strong>${tx('Webb telescope learning game', 'Game edukasi teleskop Webb')}</strong> (NASA): ${tx('the idea of matching objectives to instruments and showing similar real missions at the end.', 'ide mencocokkan tujuan dengan instrumen dan menampilkan misi nyata yang mirip di akhir.')}</li>
      <li><strong>NASA Mission Viz</strong> ${tx('and the 2023 VR challenge: inspiration for the animated orbit views.', 'dan tantangan VR 2023: inspirasi tampilan orbit beranimasi.')}</li>
    </ul>
    <h3>${tx('NASA data shown in the game', 'Data NASA yang ditampilkan di game')}</h3>
    <ul class="about-list">
      <li>${tx('Earth globe texture: NASA Blue Marble, served by NASA GIBS.', 'Tekstur bola Bumi: NASA Blue Marble, dari NASA GIBS.')}</li>
      <li>${tx('East Java image: NASA Aqua MODIS Corrected Reflectance, via NASA GIBS / Worldview.', 'Citra Jawa Timur: NASA Aqua MODIS Corrected Reflectance, lewat NASA GIBS / Worldview.')}</li>
      <li>${tx('Indonesia at night: NASA Black Marble (Suomi NPP VIIRS), via NASA GIBS.', 'Indonesia di malam hari: NASA Black Marble (Suomi NPP VIIRS), lewat NASA GIBS.')}</li>
      <li>${tx('Today\'s Sun: NASA Solar Dynamics Observatory, AIA 193 Å (live).', 'Matahari hari ini: NASA Solar Dynamics Observatory, AIA 193 Å (langsung).')}</li>
      <li>${tx('Moon map: NASA Scientific Visualization Studio CGI Moon Kit, built from LRO LROC data.', 'Peta Bulan: NASA Scientific Visualization Studio CGI Moon Kit, dari data LRO LROC.')}</li>
    </ul>
    <h3>${tx('Models', 'Model')}</h3>
    <p class="small">${tx('Kepler\'s third law, cylindrical-shadow eclipse geometry, solar-array sizing with battery recharge (Space Mission Analysis and Design), the Tsiolkovsky rocket equation, a lithium-ion cycle-life curve, swath/revisit geometry and inverse-square link scaling. Component numbers are rounded game values that keep real-world proportions; they are not engineering data.',
      'Hukum Kepler ketiga, geometri gerhana bayangan silinder, ukuran panel surya dengan pengisian baterai (Space Mission Analysis and Design), persamaan roket Tsiolkovsky, kurva umur siklus baterai litium-ion, geometri sapuan/kunjungan ulang, dan pelemahan sinyal kuadrat jarak. Angka komponen adalah nilai game yang dibulatkan dengan proporsi dunia nyata; bukan data rekayasa.')}</p>
    <h3>${tx('Sound', 'Suara')}</h3>
    <p class="small">${tx('All sounds are synthesized live in the browser, including Apollo-style "Quindar" tones (2525 Hz / 2475 Hz) that marked the start and end of each mission-control transmission. Use the speaker button to mute.',
      'Semua suara disintesis langsung di browser, termasuk nada "Quindar" ala Apollo (2525 Hz / 2475 Hz) yang menandai awal dan akhir setiap transmisi mission control. Pakai tombol speaker untuk membisukan.')}</p>
    <h3>${tx('Use of AI', 'Penggunaan AI')}</h3>
    <p class="small">${tx('Parts of this prototype\'s code and text (including the Indonesian translation) were drafted with an AI coding assistant and reviewed by the team. The game contains no AI-generated images.',
      'Sebagian kode dan teks prototipe ini (termasuk terjemahan bahasa Indonesia) disusun dengan bantuan asisten AI lalu ditinjau oleh tim. Game ini tidak memuat gambar buatan AI.')}</p>`, 'about-title');
}

export function closeOverlays() {
  const had = drawerRoot().innerHTML || modalRoot().innerHTML;
  drawerRoot().innerHTML = '';
  modalRoot().innerHTML = '';
  if (had && returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
}

export function overlayOpen() {
  return Boolean(drawerRoot().innerHTML || modalRoot().innerHTML);
}

export function toast(message, tone = 'info') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `${icon(tone === 'bad' ? 'alert' : tone === 'good' ? 'check' : 'info', { size: 16 })}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => el.classList.add('is-leaving'), 3600);
  setTimeout(() => el.remove(), 4000);
}

/** Keep keyboard focus inside an open dialog. */
export function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const container = modalRoot().querySelector('.modal') || drawerRoot().querySelector('.drawer');
  if (!container) return;
  const items = [...container.querySelectorAll('button, a[href], summary, input, select, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

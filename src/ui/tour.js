// Guided tour of the design room: a spotlight plus a coach card, one step at a time.
import { tx } from '../i18n.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { play } from './audio.js';

const KEY = 'gonogo.tour.v1';

export function tourSeen() {
  try { return localStorage.getItem(KEY) === 'done'; } catch { return true; }
}
function markSeen() {
  try { localStorage.setItem(KEY, 'done'); } catch { /* ignore */ }
}

function steps() {
  return [
    { target: '.role-tab.role-science', title: tx('Start here: Science', 'Mulai dari sini: Sains'),
      text: tx('Every mission starts with its science goal. This tab belongs to the Principal Investigator, who picks the instruments.',
        'Setiap misi dimulai dari tujuan sainsnya. Tab ini milik Peneliti Utama (PI), yang memilih instrumen.') },
    { target: '[data-tour="instruments"]', title: tx('Pick 1 or 2 instruments', 'Pilih 1 atau 2 instrumen'),
      text: tx('Green bars show how useful each instrument is for your mission. Hover a card (or tab to it) to preview its effect before you click.',
        'Bar hijau menunjukkan seberapa berguna instrumen itu untuk misimu. Arahkan kursor ke kartu untuk melihat dampaknya sebelum memilih.') },
    { target: '#dashboard .budget-block', title: tx('Watch the budget', 'Pantau anggaran'),
      text: tx('Everything costs money: hardware, testing, the rocket and years of operations. The colored bar shows which role spends what.',
        'Semua hal butuh biaya: perangkat keras, pengujian, roket, dan operasi bertahun-tahun. Bar berwarna menunjukkan siapa yang menghabiskan apa.') },
    { target: '#dashboard .gauges', title: tx('Seven resources, one spacecraft', 'Tujuh sumber daya, satu wahana'),
      text: tx('Mass, power, data, comms, time and delta-v. Green is healthy, amber is a thin margin, red is broken. Click a gauge to see the breakdown.',
        'Massa, daya, data, komunikasi, waktu, dan delta-v. Hijau berarti sehat, kuning berarti margin tipis, merah berarti bermasalah. Klik gauge untuk melihat rinciannya.') },
    { target: '#dashboard [data-tour="notes"]', title: tx("Read the Flight Director's notes", 'Baca catatan Flight Director'),
      text: tx('Every problem comes with the reason and what to try. "Learn why" opens a plain-language explanation in the Codex.',
        'Setiap masalah dilengkapi alasan dan saran perbaikan. "Learn why" membuka penjelasan sederhana di Codex.') },
    { target: '.role-tabs', title: tx('Then visit every role', 'Lalu kunjungi setiap peran'),
      text: tx('Orbit & Launch, Spacecraft, Ground & Comms. The dot on each tab shows its status. A mission only works when all four fit together.',
        'Orbit & Peluncuran, Wahana, Darat & Komunikasi. Titik di setiap tab menunjukkan statusnya. Misi hanya berhasil jika keempatnya cocok.') },
    { target: '[data-action="starter"]', title: tx('Stuck? Load a starter', 'Bingung? Muat desain awal'),
      text: tx('A starter design flies, but it has flaws. Finding and fixing them is a great way to learn.',
        'Desain awal bisa terbang, tapi punya kelemahan. Menemukan dan memperbaikinya adalah cara belajar yang bagus.') },
    { target: '[data-focus="to-gonogo"]', title: tx('Ready? Call the Go/No-Go poll', 'Siap? Mulai poll Go/No-Go'),
      text: tx('Every station reports GO or NO-GO. Then launch, fly, and find out why your mission worked, or didn\'t.',
        'Setiap stasiun melapor GO atau NO-GO. Lalu luncurkan, terbangkan, dan pelajari kenapa misimu berhasil atau gagal.') },
  ];
}

let active = null;

export function startTour({ onEnd } = {}) {
  endTour(false);
  const list = steps().filter((s) => document.querySelector(s.target));
  if (!list.length) return;
  const root = document.getElementById('tour-root');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prevFocus = document.activeElement;
  let i = 0;
  let target = null;

  root.innerHTML = `<div class="tour-catch"></div><div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text"></div>`;
  const spot = root.querySelector('.tour-spot');
  const card = root.querySelector('.tour-card');

  function position() {
    if (!target || !document.contains(target)) return;
    const r = target.getBoundingClientRect();
    const pad = 6;
    spot.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(360, vw - 32);
    card.style.width = `${cw}px`;
    const ch = card.offsetHeight;
    let top;
    let left = Math.min(Math.max(16, r.left + r.width / 2 - cw / 2), vw - cw - 16);
    if (r.bottom + 14 + ch < vh - 8) top = r.bottom + 14;
    else if (r.top - 14 - ch > 8) top = r.top - 14 - ch;
    else if (r.left - cw - 20 > 0) { top = Math.min(Math.max(16, r.top), vh - ch - 16); left = r.left - cw - 20; }
    else if (r.right + cw + 20 < vw) { top = Math.min(Math.max(16, r.top), vh - ch - 16); left = r.right + 20; }
    // Target taller than the screen: dock the card at the bottom so the top of the target stays visible.
    else top = vh - ch - 16;
    card.style.transform = `translate(${left}px, ${top}px)`;
  }

  function show() {
    const s = list[i];
    target = document.querySelector(s.target);
    if (!target) { next(); return; }
    card.innerHTML = `<p class="eyebrow">${icon('info', { size: 13 })} ${tx('Guided tour', 'Tur terpandu')} · ${i + 1} / ${list.length}</p>
      <h2 id="tour-title">${esc(s.title)}</h2>
      <p id="tour-text">${esc(s.text)}</p>
      <div class="tour-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-tour-skip>${tx('Skip tour', 'Lewati tur')}</button>
        <span class="tour-nav">
          ${i > 0 ? `<button type="button" class="btn btn-secondary btn-sm" data-tour-back>${icon('left', { size: 15 })}<span>${tx('Back', 'Kembali')}</span></button>` : ''}
          <button type="button" class="btn btn-primary btn-sm" data-tour-next>${i === list.length - 1 ? tx('Let\'s design!', 'Ayo mendesain!') : tx('Next', 'Lanjut')}${icon('right', { size: 15 })}</button>
        </span>
      </div>`;
    card.querySelector('[data-tour-next]').addEventListener('click', next);
    card.querySelector('[data-tour-back]')?.addEventListener('click', back);
    card.querySelector('[data-tour-skip]').addEventListener('click', () => endTour(true));
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    position();
    setTimeout(position, reduced ? 0 : 380);
    card.querySelector('[data-tour-next]').focus({ preventScroll: true });
    play('click');
  }
  function next() {
    if (i >= list.length - 1) { endTour(true); return; }
    i += 1;
    show();
  }
  function back() {
    if (i === 0) return;
    i -= 1;
    show();
  }
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); endTour(true); }
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'Tab') {
      const items = [...card.querySelectorAll('button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const onMove = () => requestAnimationFrame(position);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onMove);
  window.addEventListener('scroll', onMove, true);

  active = {
    cleanup(markDone) {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      root.innerHTML = '';
      if (markDone) markSeen();
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      onEnd?.();
    },
  };
  show();
}

export function endTour(markDone = true) {
  if (!active) return;
  const a = active;
  active = null;
  a.cleanup(markDone);
}

export const tourActive = () => Boolean(active);

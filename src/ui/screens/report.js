// Mission report: outcome, score, causes, real NASA data and analog missions.
import { icon, ROLE_ICON } from '../icons.js';
import { esc, num, pct, money } from '../util.js';
import { topBar, concept, reqRow, roleMeta } from '../components.js';
import { codexEntry } from '../../data/codex.js';
import { leaderboard, playerFor } from '../../state.js';
import { tx, loc, nameOf, inlineName } from '../../i18n.js';
import { flightChart } from '../flightChart.js';

const outcomeMeta = (outcome) => ({
  success: { label: tx('Mission success', 'Misi berhasil'), icon: 'check', tone: 'go' },
  partial: { label: tx('Partial success', 'Berhasil sebagian'), icon: 'alert', tone: 'caution' },
  lost: { label: tx('Mission lost', 'Misi hilang'), icon: 'x', tone: 'nogo' },
}[outcome]);

export function renderReport(state, m, ctx) {
  const r = state.result;
  const o = outcomeMeta(r.outcome);
  const s = ctx.scenario;
  const findTone = { bad: 'x', warn: 'alert', info: 'info', good: 'check' };

  const breakdown = r.breakdown.map((b) => `<li class="sb-row">
      <span class="sb-label">${esc(b.label)}<span class="muted small">${esc(b.note)}</span></span>
      <span class="sb-bar"><span style="width:${((b.pts / b.max) * 100).toFixed(1)}%"></span></span>
      <span class="sb-pts mono">${b.pts}<span class="muted">/${b.max}</span></span>
    </li>`).join('');

  const reqs = r.reqs.map((x) => reqRow(x.label, x.pass, x.value)).join('') + r.constraints.map((x) => reqRow(x.label, x.pass, x.value)).join('');

  const findings = r.findings.map((f) => {
    const c = f.concept ? codexEntry(f.concept) : null;
    return `<li class="finding f-${f.tone}">
      <span class="f-icon">${icon(findTone[f.tone], { size: 15 })}</span>
      <div><p class="f-title">${esc(f.title)}</p><p class="f-text">${esc(f.text)}</p>${c ? concept(f.concept, c.title) : ''}</div>
    </li>`;
  }).join('');

  const online = state.mode === 'online' && state.online?.phase === 'live';
  const lead = !online || state.online.isHost;
  const team = state.mode === 'team' || state.mode === 'online'
    ? `<section class="card">
        <h2 class="card-h">${icon('users')} ${tx('Team role goals', 'Target peran tim')}</h2>
        <ul class="objectives">${r.objectives.map((x) => `<li class="${x.met ? 'is-met' : ''}">
          <span class="obj-icon role-${x.role}">${icon(ROLE_ICON[x.role], { size: 16 })}</span>
          <div><p><strong>${esc(roleMeta(x.role).title)}</strong> · ${esc(playerFor(state, x.role) ?? '')}</p><p class="muted small">${esc(x.goal)}: ${esc(x.value)}</p></div>
          <span class="obj-st">${icon(x.met ? 'check' : 'x', { size: 16 })}</span></li>`).join('')}</ul>
      </section>`
    : '';

  const img = s.imagery;
  const caption = loc(img, 'caption');
  const imagery = `<section class="card imagery">
      <h2 class="card-h">${icon('satellite')} ${esc(loc(img, 'title'))}</h2>
      <figure>
        <div class="img-frame"><img src="${esc(img.src)}" alt="${esc(caption)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="true" /></div>
        <figcaption>${esc(caption)} <span class="credit">${tx('Source', 'Sumber')}: ${esc(img.credit)}. <a href="${esc(img.link)}" target="_blank" rel="noopener">${tx('Explore the data', 'Jelajahi datanya')} ${icon('external', { size: 12 })}</a></span></figcaption>
      </figure>
    </section>`;

  const analogs = pickAnalogs(s, m).map((a) => `<li class="analog">
      <p class="analog-name">${esc(a.name)} <span class="muted small">${esc(a.agency)} · ${esc(a.year)}</span></p>
      <p class="small">${esc(loc(a, 'text'))}</p>
    </li>`).join('');

  const board = leaderboard(state.scenarioId, ctx.priority.id).map((e, i) => `<li class="${e.id === state.lastSaved ? 'is-you' : ''}">
      <span class="lb-rank mono">${i + 1}</span>
      <span class="lb-name">${esc(e.name)}<span class="muted small">${esc(e.summary)}</span></span>
      <span class="lb-grade grade-${esc(e.grade)}">${esc(e.grade)}</span>
      <span class="lb-score mono">${e.score}</span>
    </li>`).join('');

  const chart = flightChart(state.flight);
  const concepts = [...new Set(r.findings.map((f) => f.concept).filter((c) => c && codexEntry(c)))];

  return `${topBar(state, ctx, 'report')}
  <main class="page report" id="main">
    <section class="report-hero st-${o.tone}">
      <div class="rh-grade grade-${r.grade.grade}" aria-label="${tx('Grade', 'Nilai')} ${r.grade.grade}">${r.grade.grade}</div>
      <div class="rh-text">
        <p class="eyebrow">${icon(o.icon, { size: 14 })} ${o.label}</p>
        <h1>${esc(s.name)}: ${esc(r.grade.label)}</h1>
        <p class="lede">${summaryLine(r, m)}</p>
        <div class="rh-stats">
          <span><strong class="mono">${r.total}</strong> / 1000 ${tx('points', 'poin')}</span>
          <span><strong class="mono">${num(r.yearsFlown, 1)}</strong> ${tx('years flown', 'tahun terbang')}</span>
          <span><strong class="mono">${pct(r.scienceRatio)}</strong> ${tx('of planned science', 'dari sains yang direncanakan')}</span>
          <span><strong class="mono">${money(r.totalCost)}</strong> ${tx('spent', 'terpakai')}</span>
        </div>
      </div>
      <div class="rh-actions">
        <button type="button" class="btn btn-primary" data-action="revise" data-focus="revise" ${lead ? '' : 'disabled'}>${icon('refresh')}<span>${tx('Revise this design', 'Revisi desain ini')}</span></button>
        <button type="button" class="btn btn-secondary" data-action="refly" data-focus="refly" ${lead ? '' : 'disabled'}>${icon('rocket')}<span>${tx('Fly it again', 'Terbangkan lagi')}</span></button>
        <button type="button" class="btn btn-ghost" data-action="share">${icon('link')}<span>${tx('Copy design link', 'Salin tautan desain')}</span></button>
        <button type="button" class="btn btn-ghost" data-action="go" data-screen="scenarios">${icon('layers')}<span>${tx('Another mission', 'Misi lain')}</span></button>
      </div>
    </section>

    <div class="report-grid">
      <div class="report-col">
        <section class="card">
          <h2 class="card-h">${icon('alert')} ${tx('Why it went this way', 'Kenapa hasilnya begini')}</h2>
          <ul class="findings">${findings}</ul>
        </section>
        ${chart ? `<section class="card">
          <h2 class="card-h">${icon('gauge')} ${tx('Flight recorder', 'Rekaman penerbangan')}</h2>
          ${chart}
        </section>` : ''}
        ${team}
        ${imagery}
      </div>
      <div class="report-col">
        <section class="card">
          <h2 class="card-h">${icon('gauge')} ${tx('Score breakdown', 'Rincian skor')}</h2>
          <ul class="score-bars">${breakdown}</ul>
        </section>
        <section class="card">
          <h2 class="card-h">${icon('check')} ${tx('Requirements', 'Requirement')}</h2>
          <ul class="req-list">${reqs}</ul>
        </section>
        <section class="card">
          <h2 class="card-h">${icon('rocket')} ${tx('Real missions like yours', 'Misi nyata yang mirip dengan misimu')}</h2>
          <ul class="analogs">${analogs}</ul>
        </section>
        ${concepts.length ? `<section class="card">
          <h2 class="card-h">${icon('book')} ${tx('Concepts from this flight', 'Konsep dari penerbangan ini')}</h2>
          <div class="chips">${concepts.map((c) => concept(c, codexEntry(c).title)).join('')}</div>
        </section>` : ''}
        <section class="card">
          <h2 class="card-h">${icon('trophy')} ${tx('Leaderboard', 'Papan skor')}: ${esc(loc(ctx.priority, 'name'))} <span class="muted small">${tx('(this browser)', '(browser ini)')}</span></h2>
          ${board ? `<ol class="leaderboard">${board}</ol>` : `<p class="muted small">${tx('No runs yet.', 'Belum ada permainan.')}</p>`}
        </section>
      </div>
    </div>
  </main>`;
}

function summaryLine(r, m) {
  if (r.outcome === 'lost') return esc(r.lost.reason);
  const failed = r.reqs.filter((x) => !x.pass).length + r.constraints.filter((x) => !x.pass).length;
  if (r.outcome === 'success') {
    const what = m.count > 1 ? tx(`constellation of ${m.count} spacecraft`, `konstelasi ${m.count} wahana`) : nameOf(m.bus);
    return esc(tx(`Every requirement met. Your ${what} in ${inlineName(m.orbit)} did its job.`, `Semua requirement terpenuhi. ${what} milikmu di ${inlineName(m.orbit)} menjalankan tugasnya.`));
  }
  return esc(tx(`${failed} requirement${failed > 1 ? 's' : ''} missed. The findings below explain why, and what to change.`, `${failed} requirement tidak terpenuhi. Temuan di bawah menjelaskan kenapa, dan apa yang perlu diubah.`));
}

function pickAnalogs(s, m) {
  const scored = s.analogs.map((a) => {
    let score = 0;
    const mt = a.match ?? {};
    if (mt.orbits?.includes(m.orbit?.id)) score += 3;
    if (mt.buses?.includes(m.bus?.id)) score += 2;
    if (mt.radios?.includes(m.radio?.id)) score += 1;
    if (mt.launchers?.includes(m.launcher?.id)) score += 1;
    if (mt.instruments?.some((i) => m.design.instruments.includes(i))) score += 2;
    if (mt.minCount && m.count >= mt.minCount) score += 3;
    return { a, score };
  });
  return scored.sort((x, y) => y.score - x.score).slice(0, 3).map((x) => x.a);
}

// Shared UI building blocks.
import { icon, ROLE_ICON } from './icons.js';
import { esc, statusPill } from './util.js';
import { ROLES } from '../data/catalog.js';
import { tx, loc, getLang, fieldOf } from '../i18n.js';
import { isMuted } from './audio.js';

export function steps() {
  return [
    { id: 'briefing', label: tx('Brief', 'Brief') },
    { id: 'design', label: tx('Design', 'Desain') },
    { id: 'gonogo', label: 'Go/No-Go' },
    { id: 'flight', label: tx('Flight', 'Terbang') },
    { id: 'report', label: tx('Report', 'Laporan') },
  ];
}

/** Two annunciator lamps: GO lit, NO-GO dark. */
export function brandMark(size = 28) {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="4" y="14" width="24" height="36" rx="2" fill="var(--go)"/>
    <rect x="35.5" y="15.5" width="21" height="33" rx="1.5" fill="none" stroke="var(--nogo)" stroke-width="3"/>
  </svg>`;
}

/** Language switch (EN | ID) and sound toggle. */
export function prefTools({ langLocked = false } = {}) {
  const lang = getLang();
  const muted = isMuted();
  const lockNote = langLocked ? tx('Language can be changed after the flight', 'Bahasa bisa diganti setelah penerbangan') : '';
  return `<div class="prefs">
    <div class="lang-switch" role="group" aria-label="${tx('Language', 'Bahasa')}" ${langLocked ? `title="${esc(lockNote)}"` : ''}>
      <button type="button" class="lang-btn ${lang === 'en' ? 'is-on' : ''}" aria-pressed="${lang === 'en'}" data-action="lang" data-id="en" ${langLocked ? 'disabled' : ''} lang="en" aria-label="English">EN</button>
      <button type="button" class="lang-btn ${lang === 'id' ? 'is-on' : ''}" aria-pressed="${lang === 'id'}" data-action="lang" data-id="id" ${langLocked ? 'disabled' : ''} lang="id" aria-label="Bahasa Indonesia">ID</button>
    </div>
    <button type="button" class="btn btn-ghost btn-sm btn-sq" data-action="sound" aria-pressed="${!muted}"
      aria-label="${muted ? tx('Sound off. Turn sound on', 'Suara mati. Nyalakan suara') : tx('Sound on. Turn sound off', 'Suara nyala. Matikan suara')}"
      title="${muted ? tx('Sound off', 'Suara mati') : tx('Sound on', 'Suara nyala')}">${icon(muted ? 'mute' : 'volume')}</button>
  </div>`;
}

export function topBar(state, ctx, current) {
  const list = steps();
  const idx = list.findIndex((s) => s.id === current);
  const stepHtml = list.map((s, i) => {
    const cls = i < idx ? 'is-done' : i === idx ? 'is-current' : '';
    return `<li class="step ${cls}" ${i === idx ? 'aria-current="step"' : ''}><span class="step-n">${i + 1}</span><span class="step-l">${s.label}</span></li>`;
  }).join('');
  const mission = ctx
    ? `<div class="tb-mission"><span class="tb-icon" style="--accent:${ctx.scenario.accent}">${icon(ctx.scenario.icon, { size: 18 })}</span>
        <span class="tb-text"><span class="tb-name">${esc(ctx.scenario.name)}</span>
        <span class="tb-sub">${esc(loc(ctx.priority, 'name'))} · ${esc(loc(ctx.difficulty, 'name'))}${state.mode === 'team' && state.teamName ? ` · ${tx('Team', 'Tim')} ${esc(state.teamName)}` : ''}</span></span></div>`
    : '';
  return `<header class="topbar">
    <button class="brand" type="button" data-action="home" aria-label="${tx('GO/NO-GO home', 'Beranda GO/NO-GO')}">${brandMark(26)}<span class="brand-name">GO/NO-GO</span></button>
    ${mission}
    <ol class="stepper" aria-label="${tx('Mission phases', 'Tahap misi')}">${stepHtml}</ol>
    <div class="tb-actions">
      <button class="btn btn-ghost btn-sm" type="button" data-action="codex">${icon('book')}<span>Codex</span></button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="howto" aria-label="${tx('How to play', 'Cara bermain')}">${icon('info')}<span>${tx('Help', 'Bantuan')}</span></button>
      ${prefTools({ langLocked: current === 'flight' })}
    </div>
  </header>`;
}

export function roleMeta(id) {
  const base = ROLES.find((r) => r.id === id) ?? { id, name: 'Mission', title: 'Flight Director', segment: 'Whole mission', blurb: '' };
  return {
    ...base,
    name: fieldOf(base, 'name'),
    title: fieldOf(base, 'title'),
    segment: fieldOf(base, 'segment'),
    blurb: fieldOf(base, 'blurb'),
  };
}

export function roleTag(role) {
  const r = roleMeta(role);
  return `<span class="role-tag role-${role}">${icon(ROLE_ICON[role] ?? 'flag', { size: 13 })}${esc(r.name)}</span>`;
}

export function optCard({ group, id, name, blurb, selected = false, disabled = null, stats = [], badges = [], foot = '', value = null, suggested = false }) {
  const statHtml = stats.length
    ? `<span class="opt-stats">${stats.map(([k, v, tone]) => `<span class="stat ${tone ? `stat-${tone}` : ''}"><span class="stat-k">${esc(k)}</span><span class="stat-v">${v}</span></span>`).join('')}</span>`
    : '';
  const valueHtml = value != null ? valueMeter(value) : '';
  const sugg = suggested && !disabled ? `<span class="badge badge-suggest">${icon('compass', { size: 11 })}${tx('Suggested', 'Disarankan')}</span>` : '';
  return `<button type="button" class="opt ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${suggested && !selected && !disabled ? 'is-suggested' : ''}"
      data-action="pick" data-group="${group}" data-id="${esc(id)}" data-preview="${group}:${esc(id)}" data-focus="opt-${group}-${esc(id)}"
      aria-pressed="${selected}" ${disabled ? 'aria-disabled="true"' : ''}>
    <span class="opt-top"><span class="opt-name">${esc(name)}</span>${sugg}${badges.join('')}<span class="opt-check" aria-hidden="true">${icon('check', { size: 14 })}</span></span>
    ${valueHtml}
    ${blurb ? `<span class="opt-blurb">${esc(blurb)}</span>` : ''}
    ${statHtml}
    ${disabled ? `<span class="opt-flag">${icon('alert', { size: 13 })}<span>${esc(disabled)}</span></span>` : foot}
  </button>`;
}

export function valueMeter(weight) {
  const level = weight >= 0.85 ? 3 : weight >= 0.5 ? 2 : weight > 0 ? 1 : 0;
  const labels = [
    tx('No value for this mission', 'Tidak berguna untuk misi ini'),
    tx('Some value', 'Cukup berguna'),
    tx('High value', 'Sangat berguna'),
    tx('Core to this mission', 'Inti misi ini'),
  ];
  const label = labels[level];
  return `<span class="value-meter v${level}" title="${label}"><span class="vm-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="vm-l">${label}</span></span>`;
}

export function badge(text, tone = '') {
  return `<span class="badge ${tone ? `badge-${tone}` : ''}">${esc(text)}</span>`;
}

export function section(title, body, { hint = '', id = '', aside = '', sub = '', tour = '' } = {}) {
  return `<section class="group" ${id ? `id="${id}"` : ''} ${tour ? `data-tour="${tour}"` : ''}>
    <div class="group-head"><h3 class="group-title">${title}</h3>${sub ? `<span class="group-sub">${esc(sub)}</span>` : ''}${aside}</div>
    ${hint ? `<p class="group-hint">${hint}</p>` : ''}
    ${body}
  </section>`;
}

export function grid(cards, cls = '') {
  return `<div class="opt-grid ${cls}">${cards.join('')}</div>`;
}

export function concept(id, label = null) {
  return `<button type="button" class="concept-link" data-action="codex" data-id="${esc(id)}">${icon('book', { size: 13 })}<span>${esc(label ?? tx('Learn why', 'Pelajari kenapa'))}</span></button>`;
}

export function issueItem(issue) {
  const ic = { critical: 'x', major: 'alert', minor: 'info', info: 'info' }[issue.severity];
  return `<li class="issue sev-${issue.severity}">
    <span class="issue-icon">${icon(ic, { size: 15 })}</span>
    <div class="issue-body">
      <div class="issue-title">${esc(issue.title)} ${roleTag(issue.role)}</div>
      <p class="issue-text">${esc(issue.text)}</p>
      ${issue.tip ? `<p class="issue-tip"><strong>${tx('Try:', 'Coba:')}</strong> ${esc(issue.tip)}</p>` : ''}
      ${issue.concept ? concept(issue.concept) : ''}
    </div>
  </li>`;
}

export function reqRow(label, pass, value, pending = false) {
  const st = pending ? 'pending' : pass ? 'pass' : 'fail';
  const ic = pending ? 'clock' : pass ? 'check' : 'x';
  return `<li class="req req-${st}"><span class="req-icon">${icon(ic, { size: 14 })}</span><span class="req-label">${esc(label)}</span><span class="req-value">${esc(value)}</span></li>`;
}

export { statusPill };

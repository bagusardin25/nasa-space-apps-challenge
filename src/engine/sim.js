// Flight simulation: a month-by-month timeline with launch, orbit insertion, commissioning,
// operations and scheduled events. Deterministic for a given seed so a run can be replayed.

import { EVENTS, eventTitle } from '../data/events.js';
import { tx, nameOf } from '../i18n.js';
import * as P from './physics.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWeighted(list, rng) {
  const total = list.reduce((a, x) => a + x.w, 0);
  let r = rng() * total;
  for (const x of list) {
    r -= x.w;
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

/**
 * Build a flight from mission metrics. Returns a mutable flight object that the UI advances with step().
 */
export function createFlight(m, ctx, seed) {
  const rng = mulberry32(seed);
  const { scenario, difficulty } = ctx;
  const requiredMonths = Math.round(m.life.required * 12);
  const flight = {
    seed,
    rng,
    requiredMonths,
    month: 0,
    phase: 'prelaunch',
    lifeMonths: Math.max(1, Math.round(m.life.mission * 12)),
    maxMonths: Math.min(Math.round(requiredMonths * 1.5), 120),
    science: 0,
    dataGB: 0,
    dvLeft: Math.max(0, m.dv.available - m.dv.insertion),
    scienceMult: 1,
    recovery: m.ops?.recovery ?? 0.5,
    extraCost: 0,
    responsibility: 0,
    downtimeQueue: 0,
    lost: null,
    log: [],
    decisions: [],
    events: [],
    pendingEvent: null,
    prelaunch: [],
    done: false,
  };
  const say = (text, tone = 'info') => flight.log.push({ month: 0, text, tone });

  // ---------- Pre-launch: mass growth (Flight Director) ----------
  if (difficulty.massGrowth) {
    const growth = m.mass.dry * 0.06;
    const limit = Math.min(m.mass.busMax, m.mass.launchCap > 0 ? m.mass.launchCap / m.count : Infinity);
    const over = m.mass.wet + growth - limit;
    if (over <= 0) {
      flight.prelaunch.push({ tone: 'good', text: tx(`Mass growth: the spacecraft came in ${growth.toFixed(1)} kg heavier than planned. Your mass margin absorbed it.`,
        `Pertambahan massa: wahana ternyata ${growth.toFixed(1)} kg lebih berat dari rencana. Margin massamu sanggup menyerapnya.`) });
    } else {
      const offload = Math.min(over, m.mass.propellant);
      const newWet = m.mass.wet + growth - offload;
      const newDry = m.mass.dry + growth;
      const newDv = m.prop ? P.rocketDeltaV(m.prop.isp, newWet, newDry) : 0;
      flight.dvLeft = Math.max(0, newDv - m.dv.insertion);
      flight.prelaunch.push({ tone: 'warn', text: tx(
        `Mass growth: the spacecraft came in ${growth.toFixed(1)} kg heavy and broke your margin. ${offload > 0 ? `You offloaded ${offload.toFixed(1)} kg of propellant to fit, leaving ${Math.round(newDv)} m/s of delta-v.` : 'There was no propellant to offload.'}`,
        `Pertambahan massa: wahana ${growth.toFixed(1)} kg lebih berat dan menembus margin. ${offload > 0 ? `Kamu mengurangi ${offload.toFixed(1)} kg propelan agar muat, menyisakan delta-v ${Math.round(newDv)} m/s.` : 'Tidak ada propelan yang bisa dikurangi.'}`) });
      if (newDv + 1e-6 < m.dv.insertion) {
        flight.lost = { phase: 'insertion', reason: tx('After offloading propellant to absorb mass growth, there was not enough delta-v left to brake into orbit.',
          'Setelah propelan dikurangi untuk menyerap pertambahan massa, delta-v yang tersisa tidak cukup untuk mengerem masuk orbit.') };
      } else if (m.orbit.dvPerYear > 0) {
        const sk = Math.max(0, flight.dvLeft - m.dv.reserveDeorbit);
        const orbitLife = m.orbit.natLife + sk / m.orbit.dvPerYear;
        const otherLimits = m.life.factors.filter((f) => f.key !== 'orbit').map((f) => f.years);
        flight.lifeMonths = Math.max(1, Math.round(Math.min(orbitLife, ...otherLimits, 15) * 12));
      }
      if (over - offload > 0.5 && !flight.lost) {
        flight.lost = { phase: 'launch', reason: tx('Mass growth pushed the spacecraft past what the bus or rocket could carry. The launch provider refused to fly it.',
          'Pertambahan massa membuat wahana melebihi kemampuan bus atau roket. Penyedia peluncuran menolak menerbangkannya.') };
      }
    }
  }

  // ---------- Launch ----------
  if (!flight.lost) {
    if (!m.launch.fits) {
      flight.lost = { phase: 'launch', reason: m.launch.cap === 0
        ? tx('The chosen rocket cannot reach this orbit at all.', 'Roket yang dipilih sama sekali tidak bisa mencapai orbit ini.')
        : tx('The spacecraft is heavier than the rocket can lift (or too big for the slot). The launch was cancelled at the pad.',
          'Wahana lebih berat dari kemampuan angkat roket (atau terlalu besar untuk slotnya). Peluncuran dibatalkan di landasan.') };
    } else if (difficulty.launchRisk && rng() > m.launcher.reliability) {
      const pctOk = Math.round(m.launcher.reliability * 100);
      flight.lost = { phase: 'launch', reason: tx(
        `Launch failure. The ${nameOf(m.launcher).toLowerCase()} has a ${pctOk}% success record, and this was one of the unlucky flights. Real agencies buy insurance or fly spares for this reason.`,
        `Peluncuran gagal. ${nameOf(m.launcher)} punya catatan keberhasilan ${pctOk}%, dan ini salah satu penerbangan yang sial. Karena itulah badan antariksa membeli asuransi atau menyiapkan cadangan.`) };
    }
  }
  // ---------- Insertion & commissioning ----------
  if (!flight.lost && !m.dv.insertionOk) {
    flight.lost = { phase: 'insertion', reason: tx(
      `Orbit insertion needed ${Math.round(m.dv.insertion)} m/s of delta-v but only ${Math.round(m.dv.available)} m/s was available. The spacecraft flew past its target.`,
      `Masuk orbit butuh delta-v ${Math.round(m.dv.insertion)} m/s, tapi hanya tersedia ${Math.round(m.dv.available)} m/s. Wahana melesat melewati targetnya.`) };
  }
  if (!flight.lost && m.adcs?.earthFieldOnly && m.orbit.commsClass !== 'leo') {
    flight.lost = { phase: 'commissioning', reason: tx('Magnetorquers had no magnetic field to push against. The spacecraft tumbled and could not point its arrays or antenna.',
      'Magnetorquer tidak punya medan magnet untuk didorong. Wahana berputar tak terkendali dan tidak bisa mengarahkan panel atau antenanya.') };
  }
  if (!flight.lost && !m.comms.linkCloses) {
    flight.lost = { phase: 'commissioning', reason: tx('The spacecraft reached orbit but no ground station could hear it. A silent spacecraft returns no science.',
      'Wahana mencapai orbit, tapi tidak ada stasiun bumi yang bisa mendengarnya. Wahana yang bisu tidak menghasilkan sains.') };
  }
  if (!flight.lost && m.power.factor < 0.5) {
    flight.lost = { phase: 'commissioning', reason: tx('The solar arrays could not supply even half the power the spacecraft needs. It fell into a permanent safe mode.',
      'Panel surya bahkan tidak bisa memasok setengah daya yang dibutuhkan wahana. Wahana terjebak dalam safe mode permanen.') };
  }

  // ---------- Schedule events ----------
  if (!flight.lost) {
    const ectx = { m, scenario, difficulty, flight, rng };
    const opp = EVENTS.filter((e) => e.kind === 'opportunity' && e.when(ectx));
    const problems = EVENTS
      .filter((e) => e.kind === 'problem' && e.when(ectx) && (difficulty.failures || !e.failure))
      .map((e) => ({ e, w: e.weight(ectx) }))
      .filter((x) => x.w > 0);
    const chosen = [];
    if (opp.length) chosen.push(opp[0]);
    const nProblems = difficulty.failures ? difficulty.events - chosen.length : 0;
    const pool = [...problems];
    for (let i = 0; i < nProblems && pool.length; i++) {
      const x = pickWeighted(pool, rng);
      chosen.push(x.e);
      pool.splice(pool.indexOf(x), 1);
    }
    const span = Math.max(2, Math.min(flight.lifeMonths, flight.maxMonths));
    const shuffled = chosen.sort(() => rng() - 0.5);
    const used = new Set();
    flight.events = shuffled.map((e, i) => {
      let month = Math.max(1, Math.min(span - 1, Math.round(((i + 1) / (shuffled.length + 1)) * span + (rng() - 0.5) * 2)));
      while (used.has(month) && month < span) month++;
      used.add(month);
      return { month, event: e, resolved: false };
    }).sort((a, b) => a.month - b.month);
  }

  flight.endMonth = Math.min(flight.lifeMonths, flight.maxMonths);
  return flight;
}

/** Advance one month. Returns the event that needs a decision, if any. */
export function step(flight, m, ctx) {
  if (flight.done || flight.pendingEvent) return flight.pendingEvent;
  if (flight.lost) {
    flight.done = true;
    return null;
  }
  flight.phase = 'operations';
  flight.month += 1;

  const downtime = Math.min(30, flight.downtimeQueue);
  flight.downtimeQueue -= downtime;
  const uptime = 1 - downtime / 30;
  const extended = flight.month > flight.requiredMonths;
  const monthly = (m.science.perYear / 12) * flight.scienceMult * uptime * (extended ? 0.5 : 1);
  flight.science += monthly;
  flight.dataGB += Math.min(m.comms.generatedGB, m.comms.downlinkGB) * 30 * uptime;
  flight.dvLeft = Math.max(0, flight.dvLeft - (m.orbit.dvPerYear / 12));

  const due = flight.events.find((x) => !x.resolved && x.month === flight.month);
  if (due) {
    flight.pendingEvent = due;
    return due;
  }
  flight.endMonth = Math.min(flight.lifeMonths, flight.maxMonths);
  if (flight.month >= flight.endMonth) flight.done = true;
  return null;
}

export function eventView(flight, m, ctx) {
  const due = flight.pendingEvent;
  if (!due) return null;
  const ectx = { m, scenario: ctx.scenario, difficulty: ctx.difficulty, flight, rng: flight.rng };
  const e = due.event;
  return {
    id: e.id,
    kind: e.kind,
    icon: e.icon,
    concept: e.concept,
    title: eventTitle(e, ectx),
    text: typeof e.text === 'function' ? e.text(ectx) : e.text,
    options: e.options(ectx).map((o) => ({ id: o.id, label: o.label, detail: o.detail, disabled: o.disabled ?? null })),
  };
}

export function resolveEvent(flight, m, ctx, optionId) {
  const due = flight.pendingEvent;
  if (!due) return null;
  const ectx = { m, scenario: ctx.scenario, difficulty: ctx.difficulty, flight, rng: flight.rng };
  const e = due.event;
  const opt = e.options(ectx).find((o) => o.id === optionId && !o.disabled);
  if (!opt) return null;
  const { text, effects = {} } = opt.resolve(ectx);
  const fx = effects;
  if (fx.downtimeDays) flight.downtimeQueue += fx.downtimeDays;
  if (fx.lifeMonths) flight.lifeMonths = Math.max(flight.month, flight.lifeMonths + fx.lifeMonths);
  if (fx.scienceMult) flight.scienceMult *= fx.scienceMult;
  if (fx.bonusYears) flight.science += m.science.perYear * fx.bonusYears;
  if (fx.cost) flight.extraCost += fx.cost;
  if (fx.dv) flight.dvLeft = Math.max(0, flight.dvLeft + fx.dv);
  if (fx.recovery) flight.recovery = Math.max(0.1, flight.recovery + fx.recovery);
  if (fx.responsibility) flight.responsibility += fx.responsibility;
  if (fx.endMission) flight.lost = { phase: 'operations', reason: fx.endMission };
  const title = eventTitle(e, ectx);
  flight.decisions.push({ month: flight.month, eventId: e.id, title, choice: opt.label, outcome: text, concept: e.concept, kind: e.kind,
    lifeChanged: Boolean(fx.endMission || (fx.lifeMonths && fx.lifeMonths < 0)) });
  flight.log.push({ month: flight.month, text: `${title}: ${text}`, tone: fx.endMission || (fx.scienceMult && fx.scienceMult < 1) || (fx.lifeMonths && fx.lifeMonths < 0) ? 'bad' : fx.bonusYears ? 'good' : 'info' });
  due.resolved = true;
  flight.pendingEvent = null;
  flight.endMonth = Math.min(flight.lifeMonths, flight.maxMonths);
  if (flight.lost || flight.month >= flight.endMonth) flight.done = true;
  return { text, effects: fx };
}

/** Run to completion, picking the first available option for every event (used by tests). */
export function autopilot(flight, m, ctx, choose = (view) => view.options.find((o) => !o.disabled)?.id) {
  let guard = 0;
  while (!flight.done && guard++ < 1000) {
    const ev = step(flight, m, ctx);
    if (ev) resolveEvent(flight, m, ctx, choose(eventView(flight, m, ctx)));
  }
  return flight;
}

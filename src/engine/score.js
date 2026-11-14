// Scoring and the post-mission analysis ("why did it go this way?").

import { HEALTHY_MARGIN } from './mission.js';
import { tx, nameOf } from '../i18n.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v, d = 0) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

export const GRADES = [
  { min: 900, grade: 'S', label: 'Outstanding', labelId: 'Luar biasa' },
  { min: 760, grade: 'A', label: 'Excellent', labelId: 'Sangat baik' },
  { min: 600, grade: 'B', label: 'Solid', labelId: 'Solid' },
  { min: 450, grade: 'C', label: 'Shaky', labelId: 'Goyah' },
  { min: 0, grade: 'D', label: 'Needs a redesign', labelId: 'Perlu desain ulang' },
];

export function roleObjectives(m) {
  const cheapest = m.launch.cheapest;
  const orbitReqs = m.reqResults.filter((r) => ['revisit', 'passes'].includes(r.req.type));
  const groundShare = m.cost.total > 0 ? m.cost.spend.ground / m.cost.total : 0;
  const overpay = cheapest ? m.launch.cost - cheapest.cost : 0;
  return [
    { role: 'science', goal: tx('Reach at least 90% of the science target', 'Capai minimal 90% target sains'), met: m.science.ratio >= 0.9,
      value: tx(`${fmt(m.science.ratio * 100)}% of target`, `${fmt(m.science.ratio * 100)}% dari target`) },
    { role: 'launch', goal: tx('Meet the coverage needs with a right-sized rocket', 'Penuhi kebutuhan cakupan dengan roket yang pas ukurannya'),
      met: m.launch.fits && orbitReqs.every((r) => r.pass) && (!cheapest || overpay <= 1.5),
      value: !m.launch.fits ? tx('rocket does not fit', 'roket tidak muat')
        : cheapest && overpay > 1.5 ? tx(`$${fmt(overpay, 1)}M more than needed`, `$${fmt(overpay, 1)} juta lebih mahal dari perlu`)
          : orbitReqs.every((r) => r.pass) ? tx('right-sized', 'pas ukurannya') : tx('coverage not met', 'cakupan belum terpenuhi') },
    { role: 'spacecraft', goal: tx('Keep mass and power margins of at least 10%', 'Jaga margin massa dan daya minimal 10%'),
      met: m.mass.margin >= HEALTHY_MARGIN.min && m.power.margin >= HEALTHY_MARGIN.min,
      value: tx(`mass ${fmt(m.mass.margin * 100)}% · power ${fmt(m.power.margin * 100)}%`, `massa ${fmt(m.mass.margin * 100)}% · daya ${fmt(m.power.margin * 100)}%`) },
    { role: 'ground', goal: tx('Deliver 98% of data while ground costs stay under 25% of budget', 'Kirim 98% data dengan biaya darat di bawah 25% anggaran'),
      met: m.comms.delivery >= 0.98 && groundShare <= 0.25,
      value: tx(`${fmt(m.comms.delivery * 100)}% delivered · ground ${fmt(groundShare * 100)}% of cost`, `${fmt(m.comms.delivery * 100)}% terkirim · darat ${fmt(groundShare * 100)}% biaya`) },
  ];
}

/** Full points inside the healthy zone; too little margin is risky, too much is wasted mass or money. */
function marginPoints(margin) {
  if (!Number.isFinite(margin) || margin < 0) return 0;
  if (margin < HEALTHY_MARGIN.min) return 25 + 250 * margin;
  if (margin <= HEALTHY_MARGIN.max) return 50;
  return Math.max(25, 50 - (margin - HEALTHY_MARGIN.max) * 40);
}

/**
 * @param m mission metrics at launch
 * @param flight finished flight
 * @param opts { team: boolean, overrides: number, cautions: number }
 */
export function scoreMission(m, flight, ctx, opts = {}) {
  const lost = flight.lost;
  const monthsFlown = flight.month;
  const yearsFlown = monthsFlown / 12;
  const lostEarly = lost && ['launch', 'insertion', 'commissioning'].includes(lost.phase);
  const totalCost = m.cost.total + flight.extraCost;

  const reqs = m.reqResults.map((rr) => {
    if (lostEarly) return { ...rr, pass: false, value: tx('mission lost', 'misi hilang') };
    if (rr.req.type === 'life') {
      const pass = yearsFlown + 1e-9 >= rr.req.min && !(lost && yearsFlown < rr.req.min);
      return { ...rr, pass, value: tx(`${fmt(yearsFlown, 1)} yr flown`, `${fmt(yearsFlown, 1)} thn terbang`) };
    }
    return rr;
  });
  const constraints = [
    { ...m.constraints[0], pass: totalCost <= m.cost.cap, value: `$${fmt(totalCost, 1)}M` },
    m.constraints[1],
  ];
  const allReqsMet = reqs.every((r) => r.pass);
  const outcome = lost ? 'lost' : allReqsMet && constraints.every((c) => c.pass) ? 'success' : 'partial';

  const targetTotal = (m.science.target || 1) * m.life.required;
  const scienceRatio = flight.science / targetTotal;

  // 300 points for hitting the planned science; up to 50 more for exceeding it by half again.
  const sciencePts = Math.round(300 * clamp(scienceRatio, 0, 1) + 50 * clamp((scienceRatio - 1) / 0.5, 0, 1));
  const reqPts = Math.round(250 * reqs.filter((r) => r.pass).length / Math.max(1, reqs.length));
  const unspent = (m.cost.cap - totalCost) / m.cost.cap;
  const budgetPts = totalCost <= m.cost.cap ? 60 + 40 * clamp(unspent / 0.25, 0, 1) : Math.max(0, 50 * (1 - (-unspent) / 0.2));
  const effPts = Math.round(budgetPts + marginPoints(m.mass.margin) + marginPoints(m.power.margin));
  const riskPts = 60 * clamp(1 - m.risk.score / 12, 0, 1);
  const respPts = Math.round(clamp(riskPts + (m.debrisOk ? 40 : 10) + flight.responsibility, 0, 100));

  const objectives = roleObjectives(m);
  let teamPts;
  let teamLabel;
  if (opts.team) {
    teamPts = 25 * objectives.filter((o) => o.met).length;
    teamLabel = tx('Teamwork (role goals met)', 'Kerja tim (target peran tercapai)');
  } else {
    const overrides = opts.overrides ?? 0;
    teamPts = Math.max(0, 100 - overrides * 25 - (opts.cautions ?? 0) * 10);
    teamLabel = tx('Go/No-Go discipline', 'Disiplin Go/No-Go');
  }

  let total = sciencePts + reqPts + effPts + respPts + teamPts;
  if (lostEarly) total = Math.min(total, 300);
  else if (lost) total = Math.min(total, 520);
  else if (outcome === 'partial') total = Math.min(total, 750);
  total = Math.round(clamp(total, 0, 1000));
  const g = GRADES.find((x) => total >= x.min);
  const grade = { ...g, label: tx(g.label, g.labelId) };
  const metCount = reqs.filter((r) => r.pass).length;
  const goalsMet = objectives.filter((o) => o.met).length;

  return {
    outcome, lost, total, grade, monthsFlown, yearsFlown, scienceRatio, totalCost, reqs, constraints, objectives,
    breakdown: [
      { id: 'science', label: tx('Science return', 'Hasil sains'), pts: sciencePts, max: 350, note: tx(`${fmt(scienceRatio * 100)}% of the planned science`, `${fmt(scienceRatio * 100)}% dari sains yang direncanakan`) },
      { id: 'reqs', label: tx('Requirements met', 'Requirement terpenuhi'), pts: reqPts, max: 250, note: tx(`${metCount} of ${reqs.length}`, `${metCount} dari ${reqs.length}`) },
      { id: 'eff', label: tx('Resource efficiency', 'Efisiensi sumber daya'), pts: effPts, max: 200, note: tx('budget, mass and power margins', 'margin anggaran, massa, dan daya') },
      { id: 'resp', label: tx('Reliability & responsibility', 'Keandalan & tanggung jawab'), pts: respPts, max: 100, note: tx('TRL risk, debris rules, safe choices', 'risiko TRL, aturan sampah antariksa, pilihan aman') },
      { id: 'team', label: teamLabel, pts: teamPts, max: 100,
        note: opts.team ? tx(`${goalsMet} of 4 role goals`, `${goalsMet} dari 4 target peran`)
          : tx(`${opts.overrides ?? 0} NO-GO and ${opts.cautions ?? 0} caution override(s)`, `${opts.overrides ?? 0} NO-GO dan ${opts.cautions ?? 0} WASPADA yang diabaikan`) },
    ],
    findings: buildFindings(m, flight, ctx, { lost, reqs, constraints, scienceRatio, totalCost }),
  };
}

const PHASE_ID = { launch: 'peluncuran', insertion: 'masuk orbit', commissioning: 'komisioning', operations: 'operasi' };
export const phaseName = (phase) => tx(phase, PHASE_ID[phase]);

function buildFindings(m, flight, ctx, r) {
  const out = [];
  if (r.lost) {
    out.push({ tone: 'bad', title: tx(`Mission lost during ${r.lost.phase}`, `Misi hilang saat ${phaseName(r.lost.phase)}`), text: r.lost.reason, concept: phaseConcept(r.lost.phase, m) });
  }
  for (const i of m.issues.filter((x) => x.severity === 'critical' || x.severity === 'major').slice(0, 5)) {
    out.push({ tone: i.severity === 'critical' ? 'bad' : 'warn', title: i.title, text: `${i.text} ${i.tip ? `${tx('Try:', 'Coba:')} ${i.tip}` : ''}`.trim(), concept: i.concept });
  }
  const life = r.reqs.find((x) => x.req.type === 'life');
  if (life && !life.pass && !r.lost) {
    const byDecisions = flight.decisions.some((dd) => dd.lifeChanged);
    out.push({ tone: 'warn', title: tx('The mission ended before its planned lifetime', 'Misi berakhir sebelum umur yang direncanakan'),
      text: tx(`It flew ${fmt(flight.month / 12, 1)} years. Lifetime was limited by ${m.life.limiting.label}${byDecisions ? ' and by decisions during flight' : ''}.`,
        `Misi terbang ${fmt(flight.month / 12, 1)} tahun. Umurnya dibatasi oleh ${m.life.limiting.label}${byDecisions ? ' dan keputusan selama penerbangan' : ''}.`), concept: 'lifetime' });
  }
  for (const d of flight.decisions) {
    out.push({ tone: d.kind === 'opportunity' ? 'good' : 'info', title: tx(`Month ${d.month}: ${d.title}`, `Bulan ${d.month}: ${d.title}`),
      text: tx(`You chose "${d.choice}". ${d.outcome}`, `Kamu memilih "${d.choice}". ${d.outcome}`), concept: d.concept });
  }
  // What went well
  if (!r.lost) {
    if (m.comms.delivery >= 0.98) {
      out.push({ tone: 'good', title: tx('All data delivered', 'Semua data terkirim'),
        text: tx(`Your downlink could carry ${fmt(m.comms.downlinkGB, 1)} GB a day against ${fmt(m.comms.generatedGB, 1)} GB generated.`,
          `Downlink-mu mampu membawa ${fmt(m.comms.downlinkGB, 1)} GB per hari, sementara data yang dihasilkan ${fmt(m.comms.generatedGB, 1)} GB.`), concept: 'data-rate' });
    }
    const inZone = (x) => x >= HEALTHY_MARGIN.min && x <= HEALTHY_MARGIN.max;
    if (inZone(m.mass.margin) && inZone(m.power.margin)) {
      out.push({ tone: 'good', title: tx('Healthy margins', 'Margin sehat'),
        text: tx(`You kept ${fmt(m.mass.margin * 100)}% mass margin and ${fmt(m.power.margin * 100)}% power margin, enough to absorb surprises without wasting resources.`,
          `Kamu menjaga margin massa ${fmt(m.mass.margin * 100)}% dan margin daya ${fmt(m.power.margin * 100)}%, cukup untuk menyerap kejutan tanpa membuang sumber daya.`), concept: 'margin' });
    } else if (m.mass.margin > HEALTHY_MARGIN.max || m.power.margin > HEALTHY_MARGIN.max) {
      const parts = [
        m.mass.margin > HEALTHY_MARGIN.max ? tx(`${fmt(m.mass.margin * 100)}% spare mass`, `cadangan massa ${fmt(m.mass.margin * 100)}%`) : null,
        m.power.margin > HEALTHY_MARGIN.max ? tx(`${fmt(m.power.margin * 100)}% spare power`, `cadangan daya ${fmt(m.power.margin * 100)}%`) : null,
      ].filter(Boolean).join(tx(' and ', ' dan '));
      out.push({ tone: 'info', title: tx('Margins larger than needed', 'Margin lebih besar dari perlu'),
        text: tx(`You carried ${parts}. Safe, but that capacity costs money and mass. A smaller bus, array or rocket might do the same job (the sweet spot is 10–45%).`,
          `Kamu membawa ${parts}. Aman, tapi kapasitas itu memakan biaya dan massa. Bus, panel, atau roket yang lebih kecil mungkin bisa melakukan hal yang sama (titik idealnya 10–45%).`), concept: 'margin' });
    }
    if (m.launch.cheapest && m.launch.cheapest.launcher.id === m.launcher.id) {
      out.push({ tone: 'good', title: tx('Cheapest suitable rocket', 'Roket termurah yang cocok'),
        text: tx(`The ${nameOf(m.launcher).toLowerCase()} was the cheapest rocket that could carry your mission.`, `${nameOf(m.launcher)} adalah roket termurah yang bisa membawa misimu.`), concept: 'launch' });
    }
    if (m.debrisOk && m.orbit.body === 'earth') {
      out.push({ tone: 'good', title: tx('Debris rules met', 'Aturan sampah antariksa dipatuhi'),
        text: tx('Your satellite will leave its orbit within the debris rules after the mission.', 'Satelitmu akan meninggalkan orbit sesuai aturan sampah antariksa setelah misi selesai.'), concept: 'debris' });
    }
    if (r.scienceRatio >= 1) {
      out.push({ tone: 'good', title: tx('Science above target', 'Sains di atas target'),
        text: tx(`You returned ${fmt(r.scienceRatio * 100)}% of the planned science.`, `Kamu menghasilkan ${fmt(r.scienceRatio * 100)}% dari sains yang direncanakan.`), concept: 'requirements' });
    }
  }
  return out;
}

function phaseConcept(phase, m) {
  if (phase === 'launch') return 'launch';
  if (phase === 'insertion') return 'delta-v';
  if (phase === 'commissioning') return m.comms.linkCloses ? (m.adcs?.earthFieldOnly ? 'attitude' : 'power') : 'data-rate';
  return 'lifetime';
}

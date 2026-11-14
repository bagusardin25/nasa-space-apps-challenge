// Post-flight strip chart for the mission report: science collected and fuel left over time,
// with a marker for every in-flight decision. Pure function (metrics in, SVG markup out).
import { esc, num, pct } from './util.js';
import { tx } from '../i18n.js';

const W = 640;
const H = 230;
const L = 44; // plot box
const R = 14;
const T = 14;
const B = 34;

/**
 * @param flight  the finished flight; flight.trace is recorded by the flight screen:
 *                { science: [[month, ratioOfTarget]], fuel: [[month, m/s]], dv0 }
 */
export function flightChart(flight) {
  const tr = flight?.trace;
  if (!tr || tr.science.length < 2) return '';
  const lastMonth = tr.science[tr.science.length - 1][0];
  const span = Math.max(1, lastMonth, flight.requiredMonths);
  const hasFuel = tr.dv0 > 0.5;
  const sciMax = Math.max(...tr.science.map(([, v]) => v));
  const yMax = Math.max(1.2, Math.ceil(sciMax * 10.5) / 10);
  const X = (mo) => L + (mo / span) * (W - L - R);
  const Y = (v) => T + (1 - Math.max(0, Math.min(yMax, v)) / yMax) * (H - T - B);
  const line = (series, scale = 1) => series.map(([mo, v]) => `${X(mo).toFixed(1)},${Y(v / scale).toFixed(1)}`).join(' ');

  // grid: horizontal lines every 25% (or 50% on tall scales), months along the bottom
  const stepY = yMax > 2 ? 0.5 : 0.25;
  let grid = '';
  for (let v = 0; v <= yMax + 1e-9; v += stepY) {
    grid += `<line class="fc-grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>
      <text class="fc-tick" x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  }
  const stepX = span <= 24 ? 6 : span <= 60 ? 12 : 24;
  for (let mo = 0; mo <= span; mo += stepX) {
    grid += `<line class="fc-grid" x1="${X(mo).toFixed(1)}" x2="${X(mo).toFixed(1)}" y1="${T}" y2="${H - B}"/>
      <text class="fc-tick" x="${X(mo).toFixed(1)}" y="${H - B + 14}" text-anchor="middle">${mo}</text>`;
  }

  const sciPts = line(tr.science);
  const area = `M${X(tr.science[0][0]).toFixed(1)},${Y(0).toFixed(1)} L${sciPts.replace(/ /g, ' L')} L${X(lastMonth).toFixed(1)},${Y(0).toFixed(1)} Z`;
  const fuel = hasFuel ? `<polyline class="fc-fuel" points="${line(tr.fuel, tr.dv0)}"/>` : '';

  const marks = flight.decisions.map((d, i) => {
    const tone = d.kind === 'opportunity' ? 'opp' : 'problem';
    const x = X(d.month).toFixed(1);
    return `<g class="fc-mark fc-${tone}"><line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}"/><circle cx="${x}" cy="${T + 2}" r="8"/><text x="${x}" y="${T + 5.5}" text-anchor="middle">${i + 1}</text></g>`;
  }).join('');
  const reqX = X(flight.requiredMonths).toFixed(1);
  const required = `<line class="fc-req" x1="${reqX}" x2="${reqX}" y1="${T}" y2="${H - B}"/>
    <text class="fc-tick fc-req-l" x="${reqX}" y="${H - B - 5}" text-anchor="end" dx="-4">${esc(tx('required life', 'umur wajib'))}</text>`;
  const end = flight.lost
    ? `<g class="fc-lost"><path d="M${X(lastMonth) - 5},${Y(tr.science[tr.science.length - 1][1]) - 5} l10,10 m0,-10 l-10,10"/></g>` : '';

  const label = tx(
    `Chart of the flight: science reached ${pct(tr.science[tr.science.length - 1][1])} of the target after ${lastMonth} months${hasFuel ? `; fuel went from ${num(tr.dv0)} to ${num(tr.fuel[tr.fuel.length - 1][1])} m/s of delta-v` : ''}.`,
    `Grafik penerbangan: sains mencapai ${pct(tr.science[tr.science.length - 1][1])} dari target setelah ${lastMonth} bulan${hasFuel ? `; bahan bakar turun dari ${num(tr.dv0)} ke ${num(tr.fuel[tr.fuel.length - 1][1])} m/s delta-v` : ''}.`);

  const svg = `<svg class="fc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${grid}
    <line class="fc-target" x1="${L}" x2="${W - R}" y1="${Y(1).toFixed(1)}" y2="${Y(1).toFixed(1)}"/>
    <text class="fc-tick fc-target-l" x="${W - R - 4}" y="${(Y(1) - 5).toFixed(1)}" text-anchor="end">${esc(tx('science target', 'target sains'))}</text>
    ${required}
    <path class="fc-sci-area" d="${area}"/>
    ${fuel}
    <polyline class="fc-sci" points="${sciPts}"/>
    ${marks}${end}
    <text class="fc-tick" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${esc(tx('mission month', 'bulan misi'))}</text>
  </svg>`;

  const legend = `<p class="fc-legend"><span><i class="fc-k-sci"></i>${tx('Science collected (% of target)', 'Sains terkumpul (% dari target)')}</span>
    ${hasFuel ? `<span><i class="fc-k-fuel"></i>${tx('Fuel left (% of delta-v at launch)', 'Sisa bahan bakar (% delta-v saat meluncur)')}</span>`
    : `<span class="muted">${tx('No fuel line: this spacecraft had no usable propellant.', 'Tanpa garis bahan bakar: wahana ini tidak membawa propelan yang bisa dipakai.')}</span>`}</p>`;

  const list = flight.decisions.length
    ? `<ol class="fc-events">${flight.decisions.map((d, i) => `<li class="fc-${d.kind === 'opportunity' ? 'opp' : 'problem'}">
        <span class="fc-n">${i + 1}</span>
        <div><p><strong>${esc(d.title)}</strong> <span class="muted small">${tx('month', 'bulan')} ${d.month}</span></p>
        <p class="small">${esc(d.choice)} → ${esc(d.outcome)}</p></div></li>`).join('')}</ol>`
    : `<p class="muted small">${tx('No in-flight decisions were needed on this flight.', 'Tidak ada keputusan yang perlu diambil selama penerbangan ini.')}</p>`;

  return `${svg}${legend}${list}`;
}

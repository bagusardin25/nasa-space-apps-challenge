// The mission model: turns a design into budgets, margins, requirement checks and explained issues.
// Pure functions only, so it runs the same in the browser and in Node tests.

import { get, LAUNCHERS, LAUNCH_CLASS_LABEL, CAPABILITIES } from '../data/catalog.js';
import { tx, nameOf, loc, capLabel, launchClassLabel, inlineName } from '../i18n.js';
import * as P from './physics.js';

const { clamp } = P;

export const EMPTY_DESIGN = Object.freeze({
  bus: null, instruments: [], orbit: null, count: 1, launcher: null, solar: null, battery: null,
  adcs: null, propulsion: null, propellant: 0, radio: null, network: null, ops: null,
});

export const HEALTHY_MARGIN = { min: 0.1, max: 0.45 };

export function normalizeDesign(design = {}) {
  return {
    ...EMPTY_DESIGN,
    ...design,
    instruments: Array.isArray(design.instruments) ? [...design.instruments] : [],
    count: clamp(Math.round(Number(design.count) || 1), 1, 8),
    propellant: Math.max(0, Number(design.propellant) || 0),
  };
}

const fmt = (v, digits = 0) => Number(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const lcName = inlineName;
const lcLabel = (cls) => launchClassLabel(cls, LAUNCH_CLASS_LABEL[cls]);

export function launchCost(launcher, wetKg, count, launchClass) {
  if (!launcher) return 0;
  if (launcher.rideshare) {
    const r = launcher.rideshare;
    return (r.base + r.perKg * wetKg) * count * (launchClass === 'deep' ? r.deepMult : 1);
  }
  return launcher.cost;
}

function marginStatus(margin) {
  if (!Number.isFinite(margin)) return 'go';
  if (margin < 0) return 'nogo';
  if (margin < HEALTHY_MARGIN.min) return 'caution';
  return 'go';
}

/**
 * @param {object} rawDesign
 * @param {{scenario: object, priority: object, difficulty: object}} ctx
 */
export function computeMission(rawDesign, ctx) {
  const d = normalizeDesign(rawDesign);
  const { scenario, priority, difficulty } = ctx;
  const issues = [];
  const add = (issue) => issues.push(issue);

  const bus = get('buses', d.bus);
  const orbit = get('orbits', d.orbit);
  const solar = get('solar', d.solar);
  const battery = get('batteries', d.battery);
  const adcs = get('adcs', d.adcs);
  const prop = get('propulsion', d.propulsion);
  const radio = get('radios', d.radio);
  const network = get('networks', d.network);
  const ops = get('ops', d.ops);
  const launcher = get('launchers', d.launcher);
  const insts = d.instruments.map((id) => get('instruments', id)).filter(Boolean);
  const count = d.count;
  const s = bus?.scale ?? 1;
  const info = orbit ? P.orbitInfo(orbit) : null;
  const requiredLife = Math.max(...priority.reqs.filter((r) => r.type === 'life').map((r) => r.min), 1);
  const weights = { ...scenario.weights, ...(priority.weights ?? {}) };
  const resGoals = { ...(scenario.resGoal ?? {}), ...(priority.resGoal ?? {}) };
  const nearEarth = orbit?.commsClass === 'leo';
  const deepSpace = orbit && (orbit.commsClass === 'moon' || orbit.commsClass === 'l1');
  const targetLabel = scenario.target ? tx(scenario.target.label, scenario.target.labelId) : tx('The target', 'Target');

  // ---------- Missing choices ----------
  const missing = [];
  const need = (value, role, label) => { if (!value) missing.push({ role, label }); };
  need(insts.length, 'science', tx('instruments', 'instrumen'));
  need(orbit, 'launch', tx('an orbit', 'orbit'));
  need(launcher, 'launch', tx('a launch vehicle', 'roket peluncur'));
  need(bus, 'spacecraft', tx('a spacecraft bus', 'bus wahana'));
  need(solar, 'spacecraft', tx('solar arrays', 'panel surya'));
  need(battery, 'spacecraft', tx('a battery', 'baterai'));
  need(adcs, 'spacecraft', tx('attitude control', 'kendali sikap'));
  need(prop, 'spacecraft', tx('a propulsion option', 'opsi propulsi'));
  need(radio, 'ground', tx('a radio', 'radio'));
  need(network, 'ground', tx('a ground network', 'jaringan stasiun bumi'));
  need(ops, 'ground', tx('an operations team', 'tim operasi'));

  // ---------- Compatibility ----------
  const solarSpec = bus && solar ? solar.byBus[bus.id] : null;
  if (bus && solar && !solarSpec) {
    add({ id: 'solar-bus', severity: 'critical', role: 'spacecraft',
      title: tx(`${nameOf(solar)} do not fit a ${nameOf(bus)}`, `${nameOf(solar)} tidak cocok untuk ${nameOf(bus)}`),
      text: tx('This array size is not available for the selected bus.', 'Ukuran panel ini tidak tersedia untuk bus yang dipilih.'),
      tip: tx('Pick another solar array.', 'Pilih panel surya lain.'), concept: 'power' });
  }
  if (bus && battery && !battery.buses.includes(bus.id)) {
    add({ id: 'battery-bus', severity: 'critical', role: 'spacecraft',
      title: tx(`${nameOf(battery)} does not suit a ${nameOf(bus)}`, `${nameOf(battery)} tidak cocok untuk ${nameOf(bus)}`),
      text: tx('The pack is either too big to fit or far too small to matter for this bus.', 'Baterai ini terlalu besar untuk dimuat atau terlalu kecil untuk bus ini.'),
      tip: tx('Pick a battery listed for this bus.', 'Pilih baterai yang tersedia untuk bus ini.'), concept: 'battery' });
  }
  if (bus && prop?.buses && !prop.buses.includes(bus.id)) {
    add({ id: 'prop-bus', severity: 'critical', role: 'spacecraft',
      title: tx(`${nameOf(prop)} needs a bigger spacecraft`, `${nameOf(prop)} butuh wahana yang lebih besar`),
      text: tx('Bipropellant engines and their tanks do not fit inside CubeSats.', 'Mesin bipropelan dan tangkinya tidak muat di dalam CubeSat.'),
      tip: tx('Use a SmallSat or Medium bus, or a smaller thruster.', 'Pakai bus SmallSat atau Menengah, atau pendorong yang lebih kecil.'), concept: 'delta-v' });
  }
  if (bus && radio?.buses && !radio.buses.includes(bus.id)) {
    add({ id: 'radio-bus', severity: 'critical', role: 'ground',
      title: tx(`${nameOf(radio)} needs a bigger spacecraft`, `${nameOf(radio)} butuh wahana yang lebih besar`),
      text: tx('A dish antenna and its power amplifier do not fit a CubeSat.', 'Antena parabola dan penguat dayanya tidak muat di CubeSat.'),
      tip: tx('Choose an S-band or X-band radio, or a larger bus.', 'Pilih radio S-band atau X-band, atau bus yang lebih besar.'), concept: 'data-rate' });
  }
  if (bus) {
    const badSize = insts.filter((i) => !bus.sizes.includes(i.size));
    if (badSize.length) {
      add({ id: 'inst-size', severity: 'critical', role: 'science',
        title: tx(`${badSize.map(nameOf).join(', ')} won't fit`, `${badSize.map(nameOf).join(', ')} tidak muat`),
        text: tx(`A ${nameOf(bus)} only carries ${bus.sizes.join('/')}-size instruments.`, `${nameOf(bus)} hanya membawa instrumen ukuran ${bus.sizes.join('/')}.`),
        tip: tx('Swap for a smaller instrument or a larger bus.', 'Ganti dengan instrumen lebih kecil atau bus lebih besar.'), concept: 'trade-off' });
    }
    if (insts.length > bus.slots) {
      add({ id: 'inst-slots', severity: 'critical', role: 'science',
        title: tx(`Too many instruments for a ${nameOf(bus)}`, `Terlalu banyak instrumen untuk ${nameOf(bus)}`),
        text: tx(`It has ${bus.slots} instrument slots but you selected ${insts.length}.`, `Bus ini punya ${bus.slots} slot instrumen, tapi kamu memilih ${insts.length}.`),
        tip: tx('Remove an instrument or choose a larger bus.', 'Kurangi instrumen atau pilih bus yang lebih besar.'), concept: 'trade-off' });
    }
  }

  // ---------- Mass ----------
  const parts = [];
  const part = (label, role, group, mass = 0, cost = 0, power = 0) => parts.push({ label, role, group, mass, cost, power });
  if (bus) part(tx(`${nameOf(bus)} structure & avionics`, `Struktur & avionik ${nameOf(bus)}`), 'spacecraft', 'bus', bus.structure, bus.cost, bus.basePower);
  for (const i of insts) part(nameOf(i), 'science', 'instrument', i.mass, i.cost, i.power * i.duty);
  if (solarSpec) part(nameOf(solar), 'spacecraft', 'power', solarSpec.mass, solarSpec.cost, 0);
  if (battery) part(nameOf(battery), 'spacecraft', 'power', battery.mass, battery.cost, 0);
  if (adcs) part(nameOf(adcs), 'spacecraft', 'adcs', adcs.mass * s, adcs.cost * s ** 0.8, adcs.power * s ** 0.6);
  if (prop && prop.id !== 'prop-none') {
    const propPower = prop.lowThrust ? prop.power * s ** 0.75 * prop.powerDuty : prop.power * s ** 0.5;
    part(nameOf(prop), 'spacecraft', 'propulsion', prop.dry * s, prop.cost * s ** 0.8, propPower);
  }
  const contactMin = orbit && network ? (orbit.contact[network.id] ?? 0) : 0;
  const txFraction = clamp(contactMin / 1440, 0.02, 1);
  if (radio) part(nameOf(radio), 'ground', 'comms', radio.mass, radio.cost, radio.power * txFraction);

  const subtotalMass = parts.reduce((a, p) => a + p.mass, 0);
  const harnessMass = subtotalMass * 0.07;
  const dryMass = subtotalMass + harnessMass;
  const maxProp = bus && prop ? prop.maxPropFrac * bus.maxMass : 0;
  const propellant = prop && prop.id !== 'prop-none' ? clamp(d.propellant, 0, maxProp) : 0;
  const wetMass = dryMass + propellant;
  const fleetMass = wetMass * count;

  if (bus && wetMass > bus.maxMass) {
    add({ id: 'bus-over', severity: 'critical', role: 'spacecraft',
      title: tx('Spacecraft too heavy for its bus', 'Wahana terlalu berat untuk busnya'),
      text: tx(`It weighs ${fmt(wetMass, 1)} kg fueled, but a ${nameOf(bus)} is built for at most ${fmt(bus.maxMass)} kg.`,
        `Massanya ${fmt(wetMass, 1)} kg dengan bahan bakar, padahal ${nameOf(bus)} dirancang untuk maksimal ${fmt(bus.maxMass)} kg.`),
      tip: tx('Remove instruments, shrink the battery or propellant, or step up to a bigger bus.', 'Kurangi instrumen, kecilkan baterai atau propelan, atau naik ke bus yang lebih besar.'), concept: 'margin' });
  }

  // ---------- Power ----------
  const loadRaw = parts.reduce((a, p) => a + p.power, 0);
  const thermalPower = loadRaw * 0.08;
  const load = loadRaw + thermalPower;
  const eclipseMin = info?.eclipseMin ?? 0;
  const sunlitMin = info?.sunlitMin ?? 1;
  const reqArray = orbit ? P.requiredArrayPower(load, eclipseMin, sunlitMin) : 0;
  const genBOL = solarSpec ? P.arrayPowerBOL(solarSpec.area, solar.cos) : 0;
  const degPerYear = nearEarth ? 0.01 : 0.025;
  const genEOL = genBOL * (1 - degPerYear) ** requiredLife;
  const powerMargin = reqArray > 0 ? (genEOL - reqArray) / reqArray : 0;
  const powerFactor = reqArray > 0 && genEOL < reqArray ? Math.max(0, genEOL / reqArray) : 1;

  // ---------- Battery ----------
  const eclipseEnergy = load * eclipseMin / 60;
  const dod = battery ? eclipseEnergy / (battery.wh * 0.9) : 0;
  const cyclesPerYear = info?.cyclesPerYear ?? 0;
  const batteryLife = battery && cyclesPerYear > 0 && dod > 0 ? P.cycleLife(Math.min(dod, 1)) / cyclesPerYear : Infinity;
  const brownout = dod > 0.8 ? (info?.eclipseFrac ?? 0) * ((dod - 0.8) / dod) : 0;
  const batteryFactor = 1 - brownout;

  // ---------- Delta-v ----------
  const dv = prop ? P.rocketDeltaV(prop.isp, wetMass, dryMass) : 0;
  const insertion = orbit?.insertionDv ?? 0;
  const insertionOk = !orbit || dv + 1e-6 >= insertion;
  const dvAfterInsertion = Math.max(0, dv - insertion);
  const deorbitDv = orbit?.deorbitDv ?? 0;
  const reserveDeorbit = deorbitDv > 0 && dvAfterInsertion >= deorbitDv ? deorbitDv : 0;
  const dvSK = Math.max(0, dvAfterInsertion - reserveDeorbit);
  // Station-keeping is only needed for the part of the mission the natural orbit can't cover;
  // disposal fuel only when a dead spacecraft would otherwise linger (or must leave GEO).
  const skYears = orbit ? Math.max(0, requiredLife - orbit.natLife) : 0;
  const skNeeded = skYears * (orbit?.dvPerYear ?? 0);
  const deorbitNeeded = orbit && deorbitDv > 0 && (orbit.id === 'geo' || orbit.natLife > requiredLife + 5) ? deorbitDv : 0;
  const dvNeeded = insertion + skNeeded + deorbitNeeded;
  const orbitLife = !orbit ? 0 : !insertionOk ? 0 : orbit.natLife + (orbit.dvPerYear > 0 ? dvSK / orbit.dvPerYear : 0);
  const cruiseMonths = prop?.lowThrust && insertion > 100 ? insertion / 100 : (orbit?.transitDays ?? 0) / 30;

  // ---------- Pointing & attitude ----------
  let momentumLife = Infinity;
  if (adcs && orbit) {
    if (adcs.earthFieldOnly && !nearEarth) {
      add({ id: 'adcs-field', severity: 'critical', role: 'spacecraft',
        title: tx('Magnetorquers have nothing to push against', 'Magnetorquer tidak punya apa-apa untuk didorong'),
        text: tx(`Earth's magnetic field is far too weak at ${lcName(orbit)}. The spacecraft would tumble.`,
          `Medan magnet Bumi terlalu lemah di ${lcName(orbit)}. Wahana akan berputar tak terkendali.`),
        tip: tx('Use reaction wheels (with thrusters to dump momentum).', 'Pakai roda reaksi (dengan pendorong untuk membuang momentum).'), concept: 'attitude' });
    }
    if (adcs.wheels && !nearEarth && (!prop || prop.id === 'prop-none')) {
      momentumLife = 0.5;
      add({ id: 'momentum', severity: 'major', role: 'spacecraft',
        title: tx('Reaction wheels will saturate', 'Roda reaksi akan jenuh'),
        text: tx('Far from Earth the wheels can only dump built-up spin with thrusters. Without propulsion, pointing is lost after a few months.',
          'Jauh dari Bumi, roda hanya bisa membuang putaran berlebih dengan pendorong. Tanpa propulsi, pengarahan hilang setelah beberapa bulan.'),
        tip: tx('Add a thruster system.', 'Tambahkan sistem pendorong.'), concept: 'attitude' });
    }
  }
  const pointingProblems = adcs ? insts.filter((i) => adcs.accuracy > i.pointing) : [];
  if (pointingProblems.length) {
    const names = pointingProblems.map(nameOf).join(', ');
    const best = fmt(Math.min(...pointingProblems.map((i) => i.pointing)), 2);
    add({ id: 'pointing', severity: 'major', role: 'spacecraft',
      title: tx('Pointing too coarse for some instruments', 'Pengarahan terlalu kasar untuk beberapa instrumen'),
      text: tx(`${names} need${pointingProblems.length === 1 ? 's' : ''} pointing better than ${best}°, but ${lcName(adcs)} only hold ${adcs.accuracy}°. Their images will smear.`,
        `${names} butuh ketepatan arah lebih baik dari ${best}°, tapi ${lcName(adcs)} hanya mampu ${adcs.accuracy}°. Citranya akan buram.`),
      tip: tx('Upgrade attitude control.', 'Tingkatkan kendali sikap.'), concept: 'attitude' });
  }

  // ---------- Radiation ----------
  const radLife = bus && orbit ? bus.radTol / orbit.radDose : Infinity;

  // ---------- Lifetime ----------
  const lifeFactors = [
    { key: 'orbit', label: orbit && orbit.dvPerYear > 0 && (orbit.body !== 'earth' || orbit.id === 'geo') ? tx('station-keeping fuel', 'bahan bakar penjaga orbit') : tx('orbit decay / fuel', 'peluruhan orbit / bahan bakar'), years: orbitLife },
    { key: 'battery', label: tx('battery wear', 'keausan baterai'), years: batteryLife },
    { key: 'radiation', label: tx('radiation damage', 'kerusakan radiasi'), years: radLife },
    { key: 'momentum', label: tx('wheel saturation', 'kejenuhan roda reaksi'), years: momentumLife },
  ];
  const limiting = lifeFactors.reduce((a, b) => (b.years < a.years ? b : a));
  const missionLife = clamp(limiting.years, 0, 15);

  // ---------- Comms & data ----------
  const bandOk = radio && network ? network.bands.includes(radio.band) : false;
  const deepOk = !deepSpace || network?.deepSpace;
  const nearOk = !(network?.deepSpace && !deepSpace);
  const radioPointingBad = radio && adcs ? adcs.accuracy > radio.pointing : false;
  let rate = radio && network && orbit && bandOk && deepOk && nearOk && contactMin > 0 ? radio.rates[orbit.commsClass] : 0;
  if (radioPointingBad) rate *= 0.1;
  const downlinkGB = rate * contactMin * 60 / 8000;
  const generatedGB = insts.reduce((a, i) => a + i.data * i.duty * 86400 / 8000, 0);
  const delivery = generatedGB > 0 ? Math.min(1, downlinkGB / generatedGB) : rate > 0 ? 1 : 0;
  const linkCloses = rate > 0;

  if (radio && network && orbit) {
    if (!bandOk) {
      add({ id: 'band', severity: 'critical', role: 'ground',
        title: tx(`${nameOf(network)} cannot receive ${radio.band}-band`, `${nameOf(network)} tidak bisa menerima ${radio.band}-band`),
        text: tx(`Its antennas do not support the ${radio.band} band, so the link never closes.`, `Antenanya tidak mendukung pita ${radio.band}, jadi tautan tidak pernah tersambung.`),
        tip: tx('Match radio band and ground network.', 'Samakan pita radio dengan jaringan stasiun bumi.'), concept: 'data-rate' });
    } else if (!deepOk) {
      add({ id: 'deep-net', severity: 'critical', role: 'ground',
        title: tx('Only the Deep Space Network can hear you out there', 'Hanya Deep Space Network yang bisa mendengarmu di sana'),
        text: tx(`Small dishes cannot pick up a signal from ${orbit.short.split('·')[0].trim()}. Distance weakens radio signals with the square of distance.`,
          `Parabola kecil tidak bisa menangkap sinyal dari ${orbit.short.split('·')[0].trim()}. Sinyal radio melemah sebanding kuadrat jarak.`),
        tip: tx('Use the NASA Deep Space Network.', 'Pakai NASA Deep Space Network.'), concept: 'dsn' });
    } else if (!nearOk) {
      add({ id: 'dsn-near', severity: 'critical', role: 'ground',
        title: tx('The Deep Space Network is not for Earth orbiters', 'Deep Space Network bukan untuk satelit orbit Bumi'),
        text: tx('DSN antenna time is reserved for missions far from Earth. Near-Earth satellites use near-Earth station networks.',
          'Waktu antena DSN dikhususkan untuk misi yang jauh dari Bumi. Satelit dekat Bumi memakai jaringan stasiun dekat Bumi.'),
        tip: tx('Use the Surabaya station or a commercial network.', 'Pakai stasiun Surabaya atau jaringan komersial.'), concept: 'dsn' });
    } else if (radio.rates[orbit.commsClass] === 0) {
      add({ id: 'radio-range', severity: 'critical', role: 'ground',
        title: tx(`${nameOf(radio)} can't reach that far`, `${nameOf(radio)} tidak bisa menjangkau sejauh itu`),
        text: tx('At this distance the signal fades below the noise.', 'Pada jarak ini sinyal tenggelam di bawah derau.'),
        tip: tx('Choose a more powerful radio.', 'Pilih radio yang lebih kuat.'), concept: 'data-rate' });
    } else if (contactMin === 0) {
      add({ id: 'no-contact', severity: 'critical', role: 'ground',
        title: tx('No ground contact', 'Tidak ada kontak dengan darat'),
        text: tx('No station in this network can see the spacecraft.', 'Tidak ada stasiun di jaringan ini yang bisa melihat wahana.'),
        tip: tx('Pick a network that covers this orbit.', 'Pilih jaringan yang menjangkau orbit ini.'), concept: 'data-rate' });
    }
    if (radioPointingBad && bandOk) {
      add({ id: 'radio-pointing', severity: 'major', role: 'ground',
        title: tx('Antenna beam is narrower than the pointing accuracy', 'Berkas antena lebih sempit dari ketepatan arah'),
        text: tx(`${nameOf(radio)} must point within ${radio.pointing}°, but attitude control only holds ${adcs.accuracy}°. Most of the signal misses Earth.`,
          `${nameOf(radio)} harus diarahkan dalam ${radio.pointing}°, tapi kendali sikap hanya mampu ${adcs.accuracy}°. Sebagian besar sinyal meleset dari Bumi.`),
        tip: tx('Upgrade attitude control or use a wider-beam radio.', 'Tingkatkan kendali sikap atau pakai radio berkas lebar.'), concept: 'attitude' });
    }
    if (radio.band === 'Ka' && scenario.tropical) {
      add({ id: 'rain-fade', severity: 'info', role: 'ground',
        title: tx('Tropical rain fades Ka-band', 'Hujan tropis meredam Ka-band'),
        text: tx('Heavy rain over Indonesia absorbs Ka-band signals. Expect some lost passes.', 'Hujan lebat di Indonesia menyerap sinyal Ka-band. Siap-siap kehilangan beberapa lintasan.'),
        tip: tx('Keep margin in the data budget.', 'Sisakan margin di anggaran data.'), concept: 'rain-fade' });
    }
  }

  // ---------- Imaging geometry & science ----------
  const targetLat = scenario.target?.lat ?? 0;
  const perInst = insts.map((inst) => {
    const w = weights[inst.cap] ?? 0;
    let q = 1;
    let geo = null;
    const notes = [];
    if (inst.img && orbit && info) {
      geo = P.imagingGeometry(inst.img, orbit, info, targetLat, count);
      if (orbit.body === 'earth' && scenario.target) {
        if (!geo.covered) { q = 0; notes.push('never sees the target'); }
        else {
          const goalRes = resGoals[inst.cap];
          if (goalRes) q *= clamp((goalRes / geo.res) ** 0.25, 0.6, 1.25);
          q *= clamp(((priority.revisitGoal ?? 3) / geo.revisit) ** 0.2, 0.6, 1.25);
          if (scenario.tropical && !inst.img.clouds) { q *= 0.75; notes.push('clouds block it part of the time'); }
        }
      }
      if (orbit.lighting === 'terminator' && !inst.img.night) { q *= 0.5; notes.push('poor dawn/dusk lighting'); }
    }
    if (adcs && adcs.accuracy > inst.pointing) { q *= 0.25; notes.push('pointing too coarse'); }
    return { inst, weight: w, quality: q, geo, notes, value: inst.sci * w * q };
  });
  // Diminishing returns: a second instrument with the same capability adds less.
  const seenCaps = {};
  for (const p of [...perInst].sort((a, b) => b.value - a.value)) {
    if (seenCaps[p.inst.cap]) p.value *= 0.4;
    seenCaps[p.inst.cap] = true;
  }
  const fleetFactor = 1 + 0.4 * (count - 1);
  const scienceRaw = perInst.reduce((a, p) => a + p.value, 0) * fleetFactor;
  const deliveryFactor = generatedGB > 0 ? delivery : linkCloses ? 1 : 0;
  const sciencePerYear = scienceRaw * powerFactor * batteryFactor * deliveryFactor;
  const scienceRatio = priority.target ? sciencePerYear / priority.target : 0;

  const capsPresent = new Set(insts.map((i) => i.cap));
  const bestFor = (cap, key) => {
    const vals = perInst.filter((p) => p.inst.cap === cap && p.geo && p.geo.covered).map((p) => p.geo[key]).filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  const passes = orbit ? (orbit.body === 'earth' ? orbit.passes * count : 0) : 0;

  // ---------- Cost ----------
  const hardwarePerSat = parts.reduce((a, p) => a + p.cost, 0);
  const hardware = hardwarePerSat * count ** 0.85;
  const ait = hardware * 0.2;
  const launchUsd = launchCost(launcher, wetMass, count, orbit?.launchClass);
  const groundSetup = network?.setup ?? 0;
  const opsPerYear = (ops ? ops.perYear * (1 + 0.15 * (count - 1)) : 0) + (network?.perYear ?? 0);
  const opsCost = opsPerYear * requiredLife;
  const totalCost = hardware + ait + launchUsd + groundSetup + opsCost;
  const budgetCap = scenario.budget * (difficulty?.budgetMult ?? 1);
  const budgetMargin = (budgetCap - totalCost) / budgetCap;
  const learn = count ** 0.85;
  const spend = {
    science: parts.filter((p) => p.role === 'science').reduce((a, p) => a + p.cost, 0) * learn,
    spacecraft: parts.filter((p) => p.role === 'spacecraft').reduce((a, p) => a + p.cost, 0) * learn + ait,
    launch: launchUsd,
    ground: (radio?.cost ?? 0) * learn + groundSetup + opsCost,
  };

  // ---------- Schedule & risk ----------
  const trlItems = [bus, ...insts, adcs, prop, radio].filter(Boolean);
  const penalties = trlItems.filter((c) => (c.trl ?? 9) < 9).map((c) => (9 - c.trl) * 5);
  const devMonths = bus
    ? bus.devMonths + (penalties.length ? Math.max(...penalties) + 2 * (penalties.length - 1) : 0) + (count > 1 ? 3 : 0)
    : 0;
  const risk = trlItems.reduce((a, c) => a + (9 - (c.trl ?? 9)), 0);
  const lowTrl = trlItems.filter((c) => (c.trl ?? 9) <= 7);

  // ---------- Launch ----------
  const launchClass = orbit?.launchClass;
  const launchCap = launcher && launchClass ? launcher.caps[launchClass] : 0;
  const launcherBusOk = !launcher?.buses || !bus || launcher.buses.includes(bus.id);
  const launchFits = launchCap > 0 && fleetMass <= launchCap && launcherBusOk;
  const launchMargin = launchCap > 0 ? 1 - fleetMass / launchCap : -1;
  let cheapest = null;
  if (orbit && bus) {
    for (const lv of LAUNCHERS) {
      const cap = lv.caps[launchClass];
      if (!cap || fleetMass > cap || (lv.buses && !lv.buses.includes(bus.id))) continue;
      const c = launchCost(lv, wetMass, count, launchClass);
      if (!cheapest || c < cheapest.cost) cheapest = { launcher: lv, cost: c };
    }
  }

  if (launcher && orbit) {
    if (launchCap === 0) {
      add({ id: 'lv-reach', severity: 'critical', role: 'launch',
        title: tx(`${nameOf(launcher)} can't reach ${lcLabel(launchClass)}`, `${nameOf(launcher)} tidak bisa mencapai ${lcLabel(launchClass)}`),
        text: tx('This rocket does not have the energy for that destination.', 'Roket ini tidak punya energi untuk tujuan itu.'),
        tip: tx('Choose a more capable launcher.', 'Pilih roket yang lebih mampu.'), concept: 'launch' });
    } else if (!launcherBusOk) {
      add({ id: 'lv-bus', severity: 'critical', role: 'launch',
        title: tx('Too big for a rideshare slot', 'Terlalu besar untuk slot rideshare'),
        text: tx(`Rideshare adapters take CubeSats and SmallSats, not a ${nameOf(bus)}.`, `Adaptor rideshare hanya menerima CubeSat dan SmallSat, bukan ${nameOf(bus)}.`),
        tip: tx('Book a dedicated launcher.', 'Pesan roket khusus.'), concept: 'launch' });
    } else if (fleetMass > launchCap) {
      add({ id: 'lv-over', severity: 'critical', role: 'launch',
        title: tx('The rocket cannot lift your spacecraft', 'Roket tidak sanggup mengangkat wahanamu'),
        text: tx(`Your ${count > 1 ? `fleet of ${count} weighs` : 'spacecraft weighs'} ${fmt(fleetMass)} kg, but the ${lcName(launcher)} carries ${fmt(launchCap)} kg to ${lcLabel(launchClass)}.`,
          `${count > 1 ? `Armada ${count} wahanamu` : 'Wahanamu'} seberat ${fmt(fleetMass)} kg, padahal ${lcName(launcher)} hanya membawa ${fmt(launchCap)} kg ke ${lcLabel(launchClass)}.`),
        tip: tx('Pick a bigger rocket, fly fewer spacecraft, or cut mass.', 'Pilih roket lebih besar, kurangi jumlah wahana, atau pangkas massa.'), concept: 'launch' });
    } else if (cheapest && cheapest.launcher.id !== launcher.id && launchUsd - cheapest.cost > 1 && launchMargin > 0.6) {
      add({ id: 'lv-oversized', severity: 'minor', role: 'launch',
        title: tx('You are paying for an empty rocket', 'Kamu membayar roket yang kosong'),
        text: tx(`You use only ${fmt((1 - launchMargin) * 100)}% of its capacity. A ${lcName(cheapest.launcher)} would do it for about $${fmt(cheapest.cost, 1)}M instead of $${fmt(launchUsd, 1)}M.`,
          `Kamu hanya memakai ${fmt((1 - launchMargin) * 100)}% kapasitasnya. ${nameOf(cheapest.launcher)} bisa melakukannya dengan sekitar $${fmt(cheapest.cost, 1)} juta, bukan $${fmt(launchUsd, 1)} juta.`),
        tip: tx('Right-size the launcher.', 'Sesuaikan ukuran roket.'), concept: 'launch' });
    }
  }

  // ---------- Power / battery / dv / life issues ----------
  if (orbit && solarSpec && reqArray > 0) {
    if (powerMargin < 0) {
      add({ id: 'power', severity: powerMargin < -0.3 ? 'critical' : 'major', role: 'spacecraft',
        title: tx('Not enough power', 'Daya tidak cukup'),
        text: tx(`At end of life the arrays give ${fmt(genEOL)} W, but the spacecraft needs ${fmt(reqArray)} W in sunlight (running everything and recharging the battery for each ${fmt(eclipseMin)}-minute eclipse).`,
          `Di akhir masa misi panel hanya memberi ${fmt(genEOL)} W, padahal wahana butuh ${fmt(reqArray)} W saat terkena Matahari (menjalankan semuanya sekaligus mengisi baterai untuk setiap gerhana ${fmt(eclipseMin)} menit).`),
        tip: tx('Bigger or sun-tracking arrays, or fewer power-hungry parts.', 'Panel lebih besar atau pelacak Matahari, atau kurangi komponen yang boros daya.'), concept: 'power' });
    } else if (powerMargin > 1.2) {
      add({ id: 'power-big', severity: 'minor', role: 'spacecraft',
        title: tx('Solar arrays are oversized', 'Panel surya kebesaran'),
        text: tx(`You have ${fmt(powerMargin * 100)}% spare power. That extra array costs mass and money.`, `Kamu punya cadangan daya ${fmt(powerMargin * 100)}%. Panel ekstra itu memakan massa dan biaya.`),
        tip: tx('A smaller array could do.', 'Panel yang lebih kecil sudah cukup.'), concept: 'margin' });
    }
  }
  if (battery && orbit && eclipseMin > 0) {
    if (dod > 0.8) {
      add({ id: 'battery-dod', severity: 'major', role: 'spacecraft',
        title: tx('Battery runs flat in eclipse', 'Baterai habis saat gerhana'),
        text: tx(`Each ${fmt(eclipseMin)}-minute eclipse needs ${fmt(eclipseEnergy)} Wh, more than the battery can safely give. Instruments shut down in the dark.`,
          `Setiap gerhana ${fmt(eclipseMin)} menit butuh ${fmt(eclipseEnergy)} Wh, melebihi kemampuan aman baterai. Instrumen mati dalam gelap.`),
        tip: tx('Choose a bigger battery.', 'Pilih baterai yang lebih besar.'), concept: 'battery' });
    } else if (batteryLife < requiredLife) {
      add({ id: 'battery-life', severity: 'major', role: 'spacecraft',
        title: tx('Battery will wear out early', 'Baterai akan cepat aus'),
        text: tx(`Each eclipse drains ${fmt(dod * 100)}% of the battery. At ${fmt(cyclesPerYear)} cycles a year it lasts about ${fmt(batteryLife, 1)} years.`,
          `Setiap gerhana menguras ${fmt(dod * 100)}% baterai. Dengan ${fmt(cyclesPerYear)} siklus per tahun, baterai bertahan sekitar ${fmt(batteryLife, 1)} tahun.`),
        tip: tx('A bigger battery is drained less deeply and lasts far longer.', 'Baterai yang lebih besar terkuras lebih dangkal dan jauh lebih awet.'), concept: 'battery' });
    }
  }
  if (orbit && prop && !insertionOk) {
    add({ id: 'insertion', severity: 'critical', role: 'spacecraft',
      title: tx('Not enough delta-v to enter orbit', 'Delta-v tidak cukup untuk masuk orbit'),
      text: tx(`Braking into ${lcName(orbit)} takes ${fmt(insertion)} m/s, but your propulsion gives ${fmt(dv)} m/s.`,
        `Mengerem masuk ke ${lcName(orbit)} butuh ${fmt(insertion)} m/s, tapi propulsimu hanya memberi ${fmt(dv)} m/s.`),
      tip: prop.id === 'prop-none'
        ? tx('Add propulsion and propellant.', 'Tambahkan propulsi dan propelan.')
        : tx('Add propellant or use a more efficient engine (higher Isp).', 'Tambah propelan atau pakai mesin yang lebih efisien (Isp lebih tinggi).'), concept: 'delta-v' });
  } else if (orbit && insertionOk && orbitLife < requiredLife && orbit.dvPerYear > 0) {
    const decay = orbit.body === 'earth' && nearEarth;
    add({ id: 'dv-life', severity: 'major', role: 'spacecraft',
      title: decay ? tx('Orbit will decay too soon', 'Orbit akan meluruh terlalu cepat') : tx('Not enough fuel for station-keeping', 'Bahan bakar tidak cukup untuk menjaga orbit'),
      text: decay
        ? tx(`At ${fmt(orbit.alt)} km thin air slowly drags the spacecraft down. It re-enters after about ${fmt(orbitLife, 1)} years.`,
          `Di ketinggian ${fmt(orbit.alt)} km, udara tipis perlahan menyeret wahana turun. Wahana jatuh kembali ke atmosfer setelah sekitar ${fmt(orbitLife, 1)} tahun.`)
        : tx(`Staying in ${lcName(orbit)} costs about ${fmt(orbit.dvPerYear)} m/s per year. Your fuel lasts ${fmt(orbitLife, 1)} years.`,
          `Bertahan di ${lcName(orbit)} butuh sekitar ${fmt(orbit.dvPerYear)} m/s per tahun. Bahan bakarmu bertahan ${fmt(orbitLife, 1)} tahun.`),
      tip: tx('Add propellant (or propulsion).', 'Tambah propelan (atau propulsi).'), concept: orbit.body === 'moon' ? 'mascons' : 'delta-v' });
  }
  if (bus && orbit && radLife < requiredLife) {
    add({ id: 'radiation', severity: 'major', role: 'spacecraft',
      title: tx('Electronics will not survive the radiation', 'Elektronik tidak akan tahan radiasi'),
      text: tx(`A ${nameOf(bus)} uses less-shielded parts. In ${lcName(orbit)} they last about ${fmt(radLife, 1)} years.`,
        `${nameOf(bus)} memakai komponen yang kurang terlindungi. Di ${lcName(orbit)}, komponennya bertahan sekitar ${fmt(radLife, 1)} tahun.`),
      tip: tx('Choose a larger bus with tougher electronics, or a gentler orbit.', 'Pilih bus lebih besar dengan elektronik lebih tangguh, atau orbit yang lebih ramah.'), concept: 'radiation' });
  }

  // ---------- Debris rule ----------
  let debrisOk = true;
  if (orbit && orbit.body === 'earth') {
    if (orbit.id === 'geo') debrisOk = dvAfterInsertion >= deorbitDv;
    else if (orbit.deorbitDv > 0) debrisOk = reserveDeorbit > 0 || orbit.natLife <= missionLife + 5;
    else debrisOk = orbit.natLife <= missionLife + 5 || reserveDeorbit > 0;
    if (!debrisOk) {
      add({ id: 'debris', severity: 'minor', role: 'launch',
        title: tx('Breaks the space debris rule', 'Melanggar aturan sampah antariksa'),
        text: orbit.id === 'geo'
          ? tx('GEO satellites must keep fuel to boost into a "graveyard" orbit at the end of the mission.', 'Satelit GEO wajib menyimpan bahan bakar untuk naik ke orbit "kuburan" di akhir misi.')
          : tx(`At ${fmt(orbit.alt)} km a dead satellite stays up for decades. Rules now ask for re-entry within 5 years of mission end.`,
            `Di ${fmt(orbit.alt)} km, satelit mati bertahan di orbit puluhan tahun. Aturan kini meminta satelit jatuh ke atmosfer dalam 5 tahun setelah misi berakhir.`),
        tip: tx(`Keep about ${fmt(deorbitDv)} m/s of delta-v in reserve for disposal.`, `Simpan sekitar ${fmt(deorbitDv)} m/s delta-v sebagai cadangan pembuangan.`), concept: 'debris' });
    }
  }

  // ---------- Requirements ----------
  const reqLabels = loc(priority, 'reqs');
  const reqLabel = (r, i) => (Array.isArray(reqLabels) && typeof reqLabels[i] === 'string' ? reqLabels[i] : r.label);
  const reqResults = priority.reqs.map((r, i) => {
    const label = reqLabel(r, i);
    switch (r.type) {
      case 'cap': {
        const mode = r.mode ?? 'all';
        const pass = mode === 'any' ? r.caps.some((c) => capsPresent.has(c)) : r.caps.every((c) => capsPresent.has(c));
        const have = r.caps.filter((c) => capsPresent.has(c)).map((c) => capLabel(c, CAPABILITIES[c]));
        return { req: r, label, pass, value: have.length ? have.join(', ') : tx('none', 'tidak ada'), role: 'science' };
      }
      case 'res': {
        const v = bestFor(r.cap, 'res');
        return { req: r, label, pass: v != null && v <= r.max, value: v == null ? tx('no coverage', 'tidak terjangkau') : `${fmt(v, v < 10 ? 1 : 0)} m`, num: v, role: 'science' };
      }
      case 'revisit': {
        const v = bestFor(r.cap, 'revisit');
        const txt = v == null || !Number.isFinite(v) ? tx('never', 'tidak pernah')
          : v < 1 ? tx(`every ${fmt(v * 24, 1)} h`, `setiap ${fmt(v * 24, 1)} jam`) : tx(`every ${fmt(v, 1)} days`, `setiap ${fmt(v, 1)} hari`);
        return { req: r, label, pass: v != null && v <= r.max, value: txt, num: v, role: 'launch' };
      }
      case 'passes':
        return { req: r, label, pass: passes >= r.min, value: Number.isFinite(passes) ? tx(`${fmt(passes, 1)} / day`, `${fmt(passes, 1)} / hari`) : tx('continuous', 'terus-menerus'), num: passes, role: 'launch' };
      case 'delivery':
        return { req: r, label, pass: delivery >= r.min, value: `${fmt(delivery * 100)}%`, num: delivery, role: 'ground' };
      case 'life':
        return { req: r, label, pass: missionLife >= r.min, value: tx(`${fmt(missionLife, 1)} yr`, `${fmt(missionLife, 1)} thn`), num: missionLife, role: 'spacecraft' };
      default:
        return { req: r, label, pass: false, value: '?' };
    }
  });
  const constraints = [
    { id: 'budget', label: tx(`Stay within the $${fmt(budgetCap)}M budget`, `Tetap dalam anggaran $${fmt(budgetCap)} juta`), pass: totalCost <= budgetCap, value: `$${fmt(totalCost, 1)}M`, role: 'mission' },
    { id: 'schedule', label: tx(`Ready to launch within ${scenario.deadline} months`, `Siap diluncurkan dalam ${scenario.deadline} bulan`), pass: devMonths <= scenario.deadline, value: tx(`${fmt(devMonths)} months`, `${fmt(devMonths)} bulan`), role: 'mission' },
  ];

  for (const rr of reqResults) {
    if (rr.pass || missing.length) continue;
    const r = rr.req;
    let tip = '';
    let concept = 'requirements';
    if (r.type === 'res') { tip = tx('A sharper instrument or a lower orbit improves detail.', 'Instrumen yang lebih tajam atau orbit yang lebih rendah memperbaiki detail.'); concept = 'resolution'; }
    if (r.type === 'revisit') { tip = tx('A wider swath, more spacecraft, or an orbit that passes the target more often.', 'Sapuan lebih lebar, wahana lebih banyak, atau orbit yang lebih sering melintasi target.'); concept = 'revisit'; }
    if (r.type === 'passes') { tip = tx('A lower-inclination orbit or more spacecraft in the constellation.', 'Orbit berinklinasi lebih rendah atau tambah wahana di konstelasi.'); concept = 'inclination'; }
    if (r.type === 'delivery') { tip = tx('More ground stations, a faster radio, or an orbit that passes your station more often.', 'Tambah stasiun bumi, radio lebih cepat, atau orbit yang lebih sering melintasi stasiunmu.'); concept = 'data-rate'; }
    if (r.type === 'life') { tip = tx(`Lifetime is limited by ${limiting.label}.`, `Umur misi dibatasi oleh ${limiting.label}.`); concept = 'lifetime'; }
    if (r.type === 'cap') { tip = tx('Add an instrument with the required capability.', 'Tambahkan instrumen dengan kemampuan yang dibutuhkan.'); concept = 'requirements'; }
    add({ id: `req-${r.type}-${r.cap ?? r.caps?.join('-') ?? ''}`, severity: 'major', role: rr.role ?? 'science',
      title: tx(`Requirement not met: ${rr.label}`, `Requirement belum terpenuhi: ${rr.label}`),
      text: tx(`Your design achieves: ${rr.value}.`, `Desainmu mencapai: ${rr.value}.`), tip, concept });
  }
  const notCovered = perInst.filter((p) => p.geo && !p.geo.covered);
  if (notCovered.length && orbit) {
    add({ id: 'coverage', severity: 'major', role: 'launch',
      title: tx('Target out of reach', 'Target di luar jangkauan'),
      text: tx(`${targetLabel} lies at ${fmt(Math.abs(targetLat), 1)}° latitude, but ${lcName(orbit)} (inclination ${orbit.inc}°) with this swath never flies over it.`,
        `${targetLabel} berada di lintang ${fmt(Math.abs(targetLat), 1)}°, tapi ${lcName(orbit)} (inklinasi ${orbit.inc}°) dengan sapuan ini tidak pernah melintas di atasnya.`),
      tip: tx('Choose an orbit with a higher inclination.', 'Pilih orbit dengan inklinasi lebih tinggi.'), concept: 'inclination' });
  }
  const useless = perInst.filter((p) => p.weight === 0);
  if (useless.length) {
    const names = useless.map((p) => nameOf(p.inst)).join(', ');
    add({ id: 'useless', severity: 'minor', role: 'science',
      title: tx('An instrument doesn\'t help this mission', 'Ada instrumen yang tidak membantu misi ini'),
      text: tx(`${names} add${useless.length === 1 ? 's' : ''} mass, power and cost but no science for this objective.`,
        `${names} menambah massa, daya, dan biaya tanpa hasil sains untuk tujuan ini.`),
      tip: tx('Drop it, or swap for something on the recommended list.', 'Buang, atau ganti dengan instrumen dari daftar yang direkomendasikan.'), concept: 'trade-off' });
  }
  if (!constraints[0].pass && !missing.length) {
    add({ id: 'budget', severity: 'critical', role: 'mission',
      title: tx('Over budget: the agency will not approve it', 'Melebihi anggaran: badan antariksa tidak akan menyetujuinya'),
      text: tx(`The mission costs $${fmt(totalCost, 1)}M against a cap of $${fmt(budgetCap)}M.`, `Misi ini berbiaya $${fmt(totalCost, 1)} juta, padahal batasnya $${fmt(budgetCap)} juta.`),
      tip: tx('Look at the biggest items in the cost breakdown.', 'Periksa pos terbesar di rincian biaya.'), concept: 'cost' });
  }
  if (!constraints[1].pass && !missing.length) {
    add({ id: 'schedule', severity: 'major', role: 'mission',
      title: tx('Will miss the launch window', 'Akan melewatkan jendela peluncuran'),
      text: tx(`Development takes ${fmt(devMonths)} months; the deadline is ${scenario.deadline}. New technology (low TRL) takes longer to qualify.`,
        `Pengembangan butuh ${fmt(devMonths)} bulan; tenggatnya ${scenario.deadline}. Teknologi baru (TRL rendah) butuh waktu lebih lama untuk dikualifikasi.`),
      tip: tx('Prefer flight-proven parts (TRL 9) or a simpler bus.', 'Utamakan komponen yang sudah teruji terbang (TRL 9) atau bus yang lebih sederhana.'), concept: 'trl' });
  }
  if (scenario.tropical && insts.some((i) => i.img && !i.img.clouds)) {
    add({ id: 'clouds', severity: 'info', role: 'science',
      title: tx('Tropical clouds', 'Awan tropis'),
      text: tx('Visible and thermal cameras cannot see through thick cloud, which covers Java much of the year.', 'Kamera visual dan termal tidak bisa menembus awan tebal, yang menutupi Jawa hampir sepanjang tahun.'),
      tip: tx('Radar sees through clouds; frequent revisits also help.', 'Radar menembus awan; kunjungan ulang yang sering juga membantu.'), concept: 'clouds' });
  }
  if (cruiseMonths >= 3 && prop?.lowThrust) {
    add({ id: 'spiral', severity: 'info', role: 'spacecraft',
      title: tx('Slow spiral to orbit', 'Spiral lambat menuju orbit'),
      text: tx(`Electric propulsion pushes gently: braking into orbit will take about ${fmt(cruiseMonths)} months.`, `Propulsi listrik mendorong dengan lembut: mengerem masuk orbit akan butuh sekitar ${fmt(cruiseMonths)} bulan.`),
      tip: tx('Fine if you can wait. ESA\'s SMART-1 reached the Moon this way.', 'Tidak masalah jika bisa menunggu. SMART-1 milik ESA mencapai Bulan dengan cara ini.'), concept: 'isp' });
  }

  // ---------- Role status ----------
  const severityRank = { critical: 3, major: 2, minor: 1, info: 0 };
  issues.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  const roleIds = ['science', 'launch', 'spacecraft', 'ground', 'mission'];
  const roles = {};
  for (const id of roleIds) {
    const own = issues.filter((i) => i.role === id);
    const miss = missing.filter((m) => m.role === id);
    let status = 'go';
    if (miss.length) status = 'incomplete';
    else if (own.some((i) => i.severity === 'critical')) status = 'nogo';
    else if (own.some((i) => i.severity === 'major')) status = 'caution';
    roles[id] = { status, issues: own, missing: miss };
  }

  const complete = missing.length === 0;
  const massMargin = bus ? Math.min(1 - wetMass / bus.maxMass, launchCap > 0 ? launchMargin : 1) : 0;

  return {
    design: d, complete, missing, issues, roles,
    parts: { list: parts, harnessMass, thermalPower },
    bus, orbit, solar, solarSpec, battery, adcs, prop, radio, network, ops, launcher, insts, info, count,
    mass: { dry: dryMass, propellant, maxProp, wet: wetMass, fleet: fleetMass, busMax: bus?.maxMass ?? 0, launchCap, launchMargin, margin: massMargin },
    power: { load, reqArray, genBOL, genEOL, margin: powerMargin, factor: powerFactor, eclipseMin, sunlitMin },
    batteryInfo: { dod, life: batteryLife, eclipseEnergy, brownout },
    dv: { available: dv, insertion, insertionOk, needed: dvNeeded, perYear: orbit?.dvPerYear ?? 0, skYears, skNeeded, deorbit: deorbitNeeded, reserveDeorbit, sk: dvSK },
    life: { mission: missionLife, required: requiredLife, limiting, factors: lifeFactors, cruiseMonths },
    comms: { contactMin, rate, downlinkGB, generatedGB, delivery, linkCloses, bandOk },
    science: { perInst, raw: scienceRaw, perYear: sciencePerYear, ratio: scienceRatio, target: priority.target, fleetFactor, deliveryFactor },
    passes,
    cost: { hardware, ait, launch: launchUsd, groundSetup, ops: opsCost, opsPerYear, total: totalCost, cap: budgetCap, margin: budgetMargin, spend },
    schedule: { devMonths, deadline: scenario.deadline },
    risk: { score: risk, lowTrl },
    launch: { fits: launchFits, cap: launchCap, margin: launchMargin, cheapest, cost: launchUsd },
    debrisOk,
    reqResults, constraints,
    statuses: {
      mass: !bus ? 'incomplete' : massMargin < 0 || (launcher && !launchFits) ? 'nogo' : marginStatus(massMargin),
      power: !solarSpec || !orbit ? 'incomplete' : marginStatus(powerMargin),
      budget: !complete ? (totalCost > budgetCap ? 'nogo' : 'incomplete') : marginStatus(budgetMargin + 0.1),
      data: !radio || !network || !insts.length ? 'incomplete' : delivery >= 0.98 ? 'go' : delivery >= 0.85 ? 'caution' : 'nogo',
      comms: !radio || !network || !orbit ? 'incomplete' : linkCloses ? (radioPointingBad ? 'caution' : 'go') : 'nogo',
      time: !bus || !orbit ? 'incomplete' : devMonths > scenario.deadline || missionLife < requiredLife ? 'nogo' : 'go',
      dv: !prop || !orbit ? 'incomplete' : !insertionOk ? 'nogo' : orbitLife < requiredLife ? 'caution' : 'go',
    },
  };
}

/** Propellant that would give the delta-v needed for the planned mission (plus 10% margin). */
export function autoPropellant(design, ctx) {
  const m = computeMission({ ...design, propellant: 0 }, ctx);
  if (!m.prop || m.prop.id === 'prop-none' || !m.orbit) return 0;
  const need = m.dv.needed * 1.1;
  const kg = P.propellantFor(need, m.prop.isp, m.mass.dry);
  return Math.min(Math.ceil(kg * 10) / 10, m.mass.maxProp);
}

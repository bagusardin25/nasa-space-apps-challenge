// Run with: node tests/engine.test.js
// Smoke tests for the mission model, flight simulation and scoring.
import assert from 'node:assert/strict';
import { computeMission, autoPropellant } from '../src/engine/mission.js';
import { createFlight, autopilot } from '../src/engine/sim.js';
import { scoreMission } from '../src/engine/score.js';
import { SCENARIOS, DIFFICULTIES, getScenario, getPriority, getDifficulty } from '../src/data/scenarios.js';
import { CATALOG } from '../src/data/catalog.js';
import { CODEX, CODEX_ID } from '../src/data/codex.js';
import { EVENTS } from '../src/data/events.js';
import { ID_TEXT, ID_CAPS } from '../src/data/i18n-id.js';
import { CAPABILITIES, ROLES } from '../src/data/catalog.js';
import { setLang } from '../src/i18n.js';
import { satelliteSchematic } from '../src/ui/satSchematic.js';
import { flightChart } from '../src/ui/flightChart.js';
import { launchStack, launchStackPanel } from '../src/ui/launchStack.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

const ctxFor = (scenarioId, priorityId, difficultyId = 'engineer') => {
  const scenario = getScenario(scenarioId);
  return { scenario, priority: getPriority(scenario, priorityId), difficulty: getDifficulty(difficultyId) };
};

function finiteDeep(obj, path = 'm', seen = new Set()) {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) return;
    seen.add(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (['design', 'bus', 'orbit', 'solar', 'battery', 'adcs', 'prop', 'radio', 'network', 'ops', 'launcher', 'insts', 'inst', 'req', 'launcherRef'].includes(k)) continue;
      finiteDeep(v, `${path}.${k}`, seen);
    }
  } else if (typeof obj === 'number') {
    assert.ok(!Number.isNaN(obj), `${path} is NaN`);
  }
}

console.log('Mission model');

test('every scenario starter design computes without NaN', () => {
  for (const s of SCENARIOS) {
    for (const p of s.priorities) {
      const m = computeMission(s.starter, ctxFor(s.id, p.id));
      assert.ok(m.complete, `${s.id} starter incomplete: ${m.missing.map((x) => x.label)}`);
      finiteDeep(m);
    }
  }
});

test('empty design is incomplete and lists missing choices for all four roles', () => {
  const m = computeMission({}, ctxFor('semeru', 'warning'));
  assert.equal(m.complete, false);
  for (const role of ['science', 'launch', 'spacecraft', 'ground']) assert.equal(m.roles[role].status, 'incomplete');
});

test('Semeru early warning: equatorial orbit + Surabaya station meets every requirement', () => {
  const m = computeMission({
    bus: 'smallsat', instruments: ['tir-wide'], orbit: 'leo-eq-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
    battery: 'bat-500', adcs: 'adcs-rw', propulsion: 'prop-none', radio: 'rad-x', network: 'single', ops: 'ops-standard',
  }, ctxFor('semeru', 'warning'));
  assert.ok(m.reqResults.every((r) => r.pass), m.reqResults.filter((r) => !r.pass).map((r) => r.req.label).join(', '));
  assert.ok(m.constraints.every((c) => c.pass));
});

test('Semeru starter has a data bottleneck (single station, SSO)', () => {
  const s = getScenario('semeru');
  const m = computeMission(s.starter, ctxFor('semeru', 'warning'));
  assert.ok(m.comms.delivery < 0.9);
});

test('high-res thermal imager cannot see Semeru from a 6° orbit', () => {
  const m = computeMission({ ...getScenario('semeru').starter, instruments: ['tir-hr'], orbit: 'leo-eq-550' }, ctxFor('semeru', 'mapping'));
  assert.ok(m.issues.some((i) => i.id === 'coverage'));
});

test('Archipelago GEO option blows the budget', () => {
  const m = computeMission({ bus: 'medium', instruments: ['iot'], orbit: 'geo', count: 1, launcher: 'lv-mediumheavy', solar: 'sa-fixed',
    battery: 'bat-1500', adcs: 'adcs-rw', propulsion: 'prop-biprop', propellant: 400, radio: 'rad-x', network: 'single', ops: 'ops-standard' },
  ctxFor('archipelago', 'messaging'));
  assert.ok(!m.constraints[0].pass);
});

test('lunar orbit without enough delta-v is flagged critical', () => {
  const m = computeMission({ ...getScenario('lunar').starter, propellant: 20 }, ctxFor('lunar', 'ice'));
  assert.ok(m.issues.some((i) => i.id === 'insertion' && i.severity === 'critical'));
});

test('magnetorquers are rejected beyond low Earth orbit', () => {
  const m = computeMission({ ...getScenario('solar').starter, adcs: 'adcs-mtq' }, ctxFor('solar', 'warning'));
  assert.ok(m.issues.some((i) => i.id === 'adcs-field'));
});

test('autoPropellant gives enough delta-v for the planned mission', () => {
  const ctx = ctxFor('lunar', 'ice');
  const design = { ...getScenario('lunar').starter };
  design.propellant = autoPropellant(design, ctx);
  const m = computeMission(design, ctx);
  assert.ok(m.dv.insertionOk);
  assert.ok(m.life.mission >= 1, `life ${m.life.mission}`);
});

test('a constellation shortens revisit time', () => {
  const ctx = ctxFor('semeru', 'balanced');
  const base = { bus: 'cube6u', instruments: ['tir-cube'], orbit: 'sso-550', launcher: 'lv-rideshare', solar: 'sa-fixed',
    battery: 'bat-120', adcs: 'adcs-rw', propulsion: 'prop-none', radio: 'rad-x', network: 'commercial', ops: 'ops-standard' };
  const one = computeMission({ ...base, count: 1 }, ctx);
  const five = computeMission({ ...base, count: 5 }, ctx);
  const rv = (m) => m.reqResults.find((r) => r.req.type === 'revisit').num;
  assert.ok(rv(five) < rv(one) / 4);
});

console.log('Flight & scoring');

test('every scenario and difficulty flies to completion with a valid score', () => {
  for (const s of SCENARIOS) {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 5; seed++) {
        const ctx = ctxFor(s.id, s.priorities[0].id, d.id);
        const design = { ...s.starter };
        if (design.propulsion !== 'prop-none') design.propellant = autoPropellant(design, ctx);
        const m = computeMission(design, ctx);
        const flight = autopilot(createFlight(m, ctx, seed), m, ctx);
        assert.ok(flight.done, `${s.id}/${d.id} did not finish`);
        const r = scoreMission(m, flight, ctx, { team: seed % 2 === 0, overrides: 0 });
        assert.ok(r.total >= 0 && r.total <= 1000, `score ${r.total}`);
        assert.ok(['success', 'partial', 'lost'].includes(r.outcome));
        assert.ok(r.findings.length > 0);
      }
    }
  }
});

test('an overweight launch is lost at the pad', () => {
  const ctx = ctxFor('semeru', 'warning');
  const m = computeMission({ ...getScenario('semeru').starter, bus: 'medium', solar: 'sa-fixed', battery: 'bat-1500', launcher: 'lv-small' }, ctx);
  const flight = autopilot(createFlight(m, ctx, 3), m, ctx);
  const r = scoreMission(m, flight, ctx);
  assert.equal(r.outcome, 'lost');
  assert.ok(r.total <= 300);
});

test('a well-designed mission can earn an A or better', () => {
  const ctx = ctxFor('archipelago', 'messaging', 'cadet');
  const m = computeMission({ bus: 'cube6u', instruments: ['iot', 'ais'], orbit: 'leo-eq-550', count: 1, launcher: 'lv-rideshare', solar: 'sa-fixed',
    battery: 'bat-120', adcs: 'adcs-mtq', propulsion: 'prop-none', radio: 'rad-s', network: 'single', ops: 'ops-lean' }, ctx);
  const flight = autopilot(createFlight(m, ctx, 7), m, ctx);
  const r = scoreMission(m, flight, ctx, { overrides: 0 });
  assert.equal(r.outcome, 'success');
  assert.ok(['S', 'A'].includes(r.grade.grade), `grade ${r.grade.grade} (${r.total})`);
});

console.log('Content integrity');

test('every concept referenced by issues and events exists in the codex', () => {
  const concepts = new Set(EVENTS.map((e) => e.concept));
  for (const s of SCENARIOS) {
    for (const p of s.priorities) {
      const m = computeMission({}, ctxFor(s.id, p.id));
      m.issues.forEach((i) => concepts.add(i.concept));
    }
  }
  ['power', 'battery', 'delta-v', 'data-rate', 'attitude', 'trade-off', 'margin', 'launch', 'dsn', 'rain-fade', 'mascons',
    'radiation', 'debris', 'requirements', 'resolution', 'revisit', 'inclination', 'lifetime', 'cost', 'trl', 'clouds', 'isp', 'l1']
    .forEach((c) => concepts.add(c));
  for (const c of concepts) assert.ok(CODEX[c], `missing codex entry: ${c}`);
});

test('catalog ids are unique', () => {
  for (const [group, list] of Object.entries(CATALOG)) {
    const ids = list.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate id in ${group}`);
  }
});

test('Cadet "Suggested" designs meet every requirement and constraint', () => {
  for (const s of SCENARIOS) {
    for (const p of s.priorities) {
      const ctx = ctxFor(s.id, p.id, 'cadet');
      const design = { ...s.guide[p.id] };
      if (design.propulsion !== 'prop-none') design.propellant = autoPropellant(design, ctx);
      const m = computeMission(design, ctx);
      const fails = [...m.reqResults.filter((r) => !r.pass).map((r) => r.req.label), ...m.constraints.filter((c) => !c.pass).map((c) => c.id)];
      assert.equal(fails.length, 0, `${s.id}/${p.id}: ${fails.join(', ')}`);
      for (const role of ['science', 'launch', 'spacecraft', 'ground', 'mission']) {
        assert.ok(['go', 'caution'].includes(m.roles[role].status), `${s.id}/${p.id} ${role} is ${m.roles[role].status}`);
      }
    }
  }
});

console.log('Bahasa Indonesia');

test('every catalog item, role and capability has Indonesian text', () => {
  for (const list of Object.values(CATALOG)) {
    for (const item of list) {
      assert.ok(ID_TEXT[item.id]?.name, `missing ID name: ${item.id}`);
      if (item.blurb) assert.ok(ID_TEXT[item.id]?.blurb, `missing ID blurb: ${item.id}`);
    }
  }
  for (const r of ROLES) assert.ok(ID_TEXT[r.id]?.title && ID_TEXT[r.id]?.blurb, `missing ID role: ${r.id}`);
  for (const cap of Object.keys(CAPABILITIES)) assert.ok(ID_CAPS[cap], `missing ID capability: ${cap}`);
});

test('every codex entry has an Indonesian version with all fields', () => {
  for (const key of Object.keys(CODEX)) {
    for (const field of ['title', 'body', 'game', 'real']) assert.ok(CODEX_ID[key]?.[field], `missing CODEX_ID.${key}.${field}`);
  }
});

test('scenario translations line up with the English requirements', () => {
  for (const s of SCENARIOS) {
    for (const f of ['kind', 'where', 'tagline', 'brief', 'users']) assert.ok(s.idn?.[f], `${s.id} missing idn.${f}`);
    assert.ok(s.imagery.idn?.title && s.imagery.idn?.caption, `${s.id} imagery`);
    for (const a of s.analogs) assert.ok(a.idn?.text, `${s.id} analog ${a.name}`);
    for (const p of s.priorities) {
      assert.ok(p.idn?.name && p.idn?.desc, `${s.id}/${p.id} name/desc`);
      assert.equal(p.idn.reqs.length, p.reqs.length, `${s.id}/${p.id} requirement labels`);
    }
  }
});

test('the whole game runs in Bahasa Indonesia without errors', () => {
  setLang('id');
  try {
    for (const s of SCENARIOS) {
      const ctx = ctxFor(s.id, s.priorities[0].id, 'director');
      const m = computeMission(s.starter, ctx);
      assert.ok(m.reqResults[0].label === s.priorities[0].idn.reqs[0], 'requirement label is localized');
      const flight = autopilot(createFlight(m, ctx, 11), m, ctx);
      const r = scoreMission(m, flight, ctx, { overrides: 1, cautions: 1 });
      assert.ok(r.findings.every((f) => typeof f.title === 'string' && f.title.length > 0));
      assert.ok(!/undefined|NaN/.test(JSON.stringify(r.findings)), 'no undefined/NaN in findings');
    }
    const empty = computeMission({}, ctxFor('semeru', 'warning'));
    assert.equal(empty.missing[0].label, 'instrumen');
  } finally {
    setLang('en');
  }
});

console.log('Design room schematic');

test('the spacecraft schematic draws every design without broken numbers', () => {
  for (const s of SCENARIOS) {
    const ctx = ctxFor(s.id, s.priorities[0].id);
    const empty = computeMission({}, ctx);
    const designs = [{}, s.starter, ...Object.values(s.guide ?? {})];
    for (const bus of CATALOG.buses) for (const solar of CATALOG.solar) designs.push({ ...s.starter, bus: bus.id, solar: solar.id });
    for (const prop of CATALOG.propulsion) designs.push({ ...s.starter, propulsion: prop.id, propellant: 3 });
    for (const radio of CATALOG.radios) designs.push({ ...s.starter, radio: radio.id });
    for (const inst of CATALOG.instruments) designs.push({ ...s.starter, bus: 'medium', instruments: [inst.id] });
    for (const d of designs) {
      const m = computeMission(d, ctx);
      for (const html of [satelliteSchematic(m), satelliteSchematic(empty, m)]) {
        assert.ok(html.includes('<svg'), 'no svg');
        assert.ok(!/NaN|undefined|Infinity/.test(html), `bad value in schematic for ${s.id} ${JSON.stringify(d)}`);
      }
    }
  }
});

test('the schematic follows the chosen parts and marks previews', () => {
  const s = getScenario('semeru');
  const ctx = ctxFor('semeru', s.priorities[0].id);
  const base = computeMission({ ...s.starter, bus: 'smallsat', solar: 'sa-fixed', propulsion: 'prop-none', propellant: 0 }, ctx);
  const next = computeMission({ ...s.starter, bus: 'smallsat', solar: 'sa-track', propulsion: 'prop-mono', propellant: 5 }, ctx);
  const a = satelliteSchematic(base);
  const b = satelliteSchematic(next);
  assert.notEqual(a, b);
  assert.ok(!a.includes('sch-joint') && b.includes('sch-joint'), 'tracking wings should add a rotary joint');
  assert.ok(!a.includes('sch-tank') && b.includes('sch-tank'), 'propulsion should add a tank');
  assert.ok(!a.includes('sch-new'));
  assert.ok(satelliteSchematic(base, next).includes('sch-new'), 'previewed changes should be highlighted');
});

test('the flight recorder chart draws a finished flight and stays empty without a trace', () => {
  const s = getScenario('lunar');
  const ctx = ctxFor('lunar', s.priorities[0].id);
  const guide = Object.values(s.guide)[0];
  const m = computeMission({ ...guide, propellant: autoPropellant(guide, ctx) }, ctx);
  let seed = 1;
  let f = createFlight(m, ctx, seed);
  while (f.lost && seed < 50) f = createFlight(m, ctx, ++seed);
  assert.equal(f.lost, null, 'expected at least one seed to reach orbit');
  assert.equal(flightChart(f), '');
  const target = m.science.target * m.life.required;
  f.trace = { science: [[0, 0]], fuel: [[0, f.dvLeft]], dv0: f.dvLeft };
  autopilot(f, m, ctx, (view) => {
    f.trace.science.push([f.month, f.science / target]);
    f.trace.fuel.push([f.month, f.dvLeft]);
    return view.options.find((o) => !o.disabled)?.id;
  });
  f.trace.science.push([f.month + 1, f.science / target]);
  f.trace.fuel.push([f.month + 1, f.dvLeft]);
  const html = flightChart(f);
  assert.ok(html.includes('fc-sci') && html.includes('fc-fuel'));
  assert.ok(!/NaN|undefined|Infinity/.test(html));
  assert.equal((html.match(/class="fc-mark/g) ?? []).length, f.decisions.length);
});

console.log('Launch stack (3D rocket panel)');

test('the launch stack describes every starter design in both languages', () => {
  const hosts = ['lv-small', 'lv-medium', 'lv-mediumheavy', 'lv-heavy'];
  for (const lang of ['en', 'id']) {
    setLang(lang);
    try {
      for (const s of SCENARIOS) {
        const stack = launchStack(computeMission(s.starter, ctxFor(s.id, s.priorities[0].id)));
        assert.equal(stack.status, 'fits', `${s.id} starter should fit its rocket`);
        assert.ok(hosts.includes(stack.hostId), `${s.id}: unknown rocket shape ${stack.hostId}`);
        assert.ok(stack.sat?.bus && stack.used > 0 && stack.used <= 1);
        const html = launchStackPanel(stack);
        assert.ok(html.includes('data-rocket-slot'));
        assert.ok(!/NaN|undefined|Infinity/.test(html + JSON.stringify(stack)), `${s.id}/${lang}: broken text`);
      }
    } finally {
      setLang('en');
    }
  }
});

test('the launch stack follows the rocket choice: rideshare, too heavy, too big, nothing chosen', () => {
  const ctx = ctxFor('semeru', 'warning');
  const starter = getScenario('semeru').starter;
  const ride = launchStack(computeMission(starter, ctx));
  assert.equal(ride.hostId, 'lv-mediumheavy');
  assert.ok(ride.rideshare && ride.labels.others);

  const big = { ...starter, bus: 'medium', solar: 'sa-fixed', battery: 'bat-1500' };
  const over = launchStack(computeMission({ ...big, launcher: 'lv-small' }, ctx));
  assert.equal(over.status, 'over');
  assert.ok(over.alarm && over.tone === 'bad' && over.used > 1);
  assert.equal(launchStack(computeMission({ ...big, launcher: 'lv-rideshare' }, ctx)).status, 'too-big');

  const none = launchStack(computeMission({}, ctx));
  assert.equal(none.status, 'none');
  assert.ok(none.ghost && none.sat === null && none.rows.every((r) => r[2] === null));

  const m = computeMission(starter, ctx);
  const preview = launchStack(m, computeMission({ ...starter, launcher: 'lv-heavy' }, ctx));
  assert.ok(preview.preview && preview.rows[0][3], 'a hovered rocket is marked as a preview change');
  assert.equal(preview.hostId, 'lv-heavy');
  assert.ok(preview.labels.boost);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);

// Apply one catalog choice to a design. Shared by the local UI and the online room,
// so a pick means the same thing on every machine.
import { get } from '../data/catalog.js';
import { autoPropellant, normalizeDesign } from '../engine/mission.js';
import { tx, nameOf } from '../i18n.js';
import { smart } from './util.js';

export function applyPick(design, group, id, { silent = false, ctx = null } = {}) {
  const d = normalizeDesign(design);
  const notes = [];
  if (group === 'instruments') {
    const has = d.instruments.includes(id);
    if (has) d.instruments = d.instruments.filter((x) => x !== id);
    else d.instruments.push(id);
  } else if (group === 'bus') {
    d.bus = id;
    const bus = get('buses', id);
    const bn = nameOf(bus);
    const solar = get('solar', d.solar);
    if (solar && !solar.byBus[id]) { notes.push(tx(`${nameOf(solar)} removed: not made for a ${bn}.`, `${nameOf(solar)} dilepas: tidak dibuat untuk ${bn}.`)); d.solar = null; }
    const bat = get('batteries', d.battery);
    if (bat && !bat.buses.includes(id)) { notes.push(tx(`${nameOf(bat)} removed: not offered for a ${bn}.`, `${nameOf(bat)} dilepas: tidak tersedia untuk ${bn}.`)); d.battery = null; }
    const prop = get('propulsion', d.propulsion);
    if (prop?.buses && !prop.buses.includes(id)) { notes.push(tx(`${nameOf(prop)} removed: too big for a ${bn}.`, `${nameOf(prop)} dilepas: terlalu besar untuk ${bn}.`)); d.propulsion = null; d.propellant = 0; }
    const radio = get('radios', d.radio);
    if (radio?.buses && !radio.buses.includes(id)) { notes.push(tx(`${nameOf(radio)} removed: needs a bigger spacecraft.`, `${nameOf(radio)} dilepas: butuh wahana lebih besar.`)); d.radio = null; }
    const keep = d.instruments.filter((x) => bus.sizes.includes(get('instruments', x).size));
    const dropped = d.instruments.filter((x) => !keep.includes(x));
    if (dropped.length) {
      const names = dropped.map((x) => nameOf(get('instruments', x))).join(', ');
      notes.push(tx(`${names} removed: too big for a ${bn}.`, `${names} dilepas: terlalu besar untuk ${bn}.`));
    }
    if (keep.length > bus.slots) notes.push(tx(`Only ${bus.slots} instrument slots: kept the first ${bus.slots}.`, `Hanya ${bus.slots} slot instrumen: ${bus.slots} yang pertama dipertahankan.`));
    d.instruments = keep.slice(0, bus.slots);
  } else if (group === 'propulsion') {
    d.propulsion = id;
    if (id === 'prop-none') d.propellant = 0;
    else if (ctx && d.bus && d.orbit) {
      const kgNeeded = autoPropellant(d, ctx);
      d.propellant = kgNeeded;
      if (!silent) notes.push(kgNeeded > 0
        ? tx(`Propellant auto-sized to ${smart(kgNeeded)} kg for this mission's delta-v. Adjust it with the slider.`,
          `Propelan otomatis diatur ${smart(kgNeeded)} kg sesuai delta-v misi ini. Atur dengan slider.`)
        : tx('This orbit needs no maneuvers for the planned mission, so the tank starts empty. Add propellant with the slider if you want a reserve.',
          'Orbit ini tidak butuh manuver untuk misi yang direncanakan, jadi tangki dimulai kosong. Tambah propelan dengan slider jika ingin cadangan.'));
    }
  } else {
    d[group] = id;
  }
  const prop = get('propulsion', d.propulsion);
  const bus = get('buses', d.bus);
  if (prop && bus) d.propellant = Math.min(d.propellant, prop.maxPropFrac * bus.maxMass);
  return { design: d, notes };
}


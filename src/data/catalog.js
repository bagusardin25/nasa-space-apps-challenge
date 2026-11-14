// Component catalog for GO/NO-GO.
// Numbers are simplified, rounded "game values" chosen to keep real-world proportions
// (masses in kg, power in W, cost in US$ millions, data rates in Mbps).
// Subsystems that scale with spacecraft size use the bus `scale` factor (see engine/mission.js).

export const ROLES = [
  { id: 'science', name: 'Science', title: 'Principal Investigator', segment: 'User segment',
    blurb: 'Owns the mission objective. Picks instruments and fights for science return.' },
  { id: 'launch', name: 'Orbit & Launch', title: 'Launch & Orbit Officer', segment: 'Launch segment',
    blurb: 'Chooses where the spacecraft flies, how many to build, and the rocket that gets them there.' },
  { id: 'spacecraft', name: 'Spacecraft', title: 'Spacecraft Engineer', segment: 'Space segment',
    blurb: 'Builds the bus: structure, power, batteries, pointing and propulsion. Guards the margins.' },
  { id: 'ground', name: 'Ground & Comms', title: 'Ground & Comms Lead', segment: 'Ground segment',
    blurb: 'Gets the data home: radios, ground stations and the operations team.' },
];

export const CAPABILITIES = {
  thermal: 'Thermal infrared',
  multispectral: 'Multispectral',
  optical: 'Visible imaging',
  radar: 'Radar (SAR)',
  neutron: 'Neutron spectroscopy',
  'ir-spectro': 'Infrared spectroscopy',
  altimeter: 'Laser altimetry',
  magnetometer: 'Magnetic field',
  plasma: 'Solar wind plasma',
  particles: 'Energetic particles',
  coronagraph: 'Coronagraph imaging',
  iot: 'IoT messaging relay',
  ais: 'Ship tracking (AIS)',
};

export const BUSES = [
  { id: 'cube6u', name: '6U CubeSat', structure: 2.4, maxMass: 14, slots: 2, sizes: ['S'], basePower: 5,
    cost: 0.9, scale: 1, radTol: 3, devMonths: 18, trl: 9,
    blurb: 'Shoebox-sized (10 × 20 × 30 cm). Cheap and quick to build, but tight on mass, power and room.' },
  { id: 'cube12u', name: '12U CubeSat', structure: 4.2, maxMass: 24, slots: 3, sizes: ['S'], basePower: 8,
    cost: 1.5, scale: 1.8, radTol: 3.5, devMonths: 22, trl: 9,
    blurb: 'Two shoeboxes side by side. Room for a third small instrument or a propulsion module.' },
  { id: 'smallsat', name: 'SmallSat (ESPA-class)', structure: 55, maxMass: 320, slots: 3, sizes: ['S', 'M'], basePower: 40,
    cost: 11, scale: 12, radTol: 12, devMonths: 36, trl: 9,
    blurb: 'Mini-fridge sized. Carries mid-sized instruments, real propulsion and tougher electronics.' },
  { id: 'medium', name: 'Medium spacecraft', structure: 320, maxMass: 2600, slots: 5, sizes: ['S', 'M', 'L'], basePower: 160,
    cost: 65, scale: 50, radTol: 30, devMonths: 54, trl: 9,
    blurb: 'Car-sized. Fits large instruments and big antennas, but every kilogram drives launch cost.' },
];

export const INSTRUMENTS = [
  { id: 'tir-wide', name: 'Wide-swath Thermal Radiometer', cap: 'thermal', size: 'M', mass: 35, power: 45, cost: 16,
    data: 8, duty: 0.5, sci: 30, trl: 9, pointing: 0.5,
    img: { res500: 700, swath500: 1650, night: true, clouds: false },
    blurb: 'Sees a 1,800 km-wide strip at ~1 km detail. Spots hot volcanoes and fires almost daily.' },
  { id: 'tir-hr', name: 'High-res Thermal Imager', cap: 'thermal', size: 'M', mass: 55, power: 90, cost: 28,
    data: 45, duty: 0.2, sci: 32, trl: 9, pointing: 0.1,
    img: { res500: 70, swath500: 130, night: true, clouds: false },
    blurb: 'Maps lava flows at ~70 m detail, but its narrow strip means you wait days for a revisit.' },
  { id: 'tir-cube', name: 'Thermal CubeCam', cap: 'thermal', size: 'S', mass: 2.2, power: 10, cost: 2.5,
    data: 6, duty: 0.2, sci: 14, trl: 6, pointing: 0.5,
    img: { res500: 180, swath500: 90, night: true, clouds: false },
    blurb: 'A thermal camera small enough for a CubeSat. New technology: cheaper, but riskier.' },
  { id: 'msi', name: 'Multispectral Imager', cap: 'multispectral', size: 'M', mass: 50, power: 70, cost: 26,
    data: 120, duty: 0.15, sci: 26, trl: 9, pointing: 0.1,
    img: { res500: 20, swath500: 130, night: false, clouds: false },
    blurb: 'Sees colors beyond the human eye: ash plumes, burnt land and crop health.' },
  { id: 'optical-hr', name: 'High-res Optical Camera', cap: 'optical', size: 'M', mass: 70, power: 80, cost: 35,
    data: 350, duty: 0.08, sci: 24, trl: 9, pointing: 0.02,
    img: { res500: 1, swath500: 12, night: false, clouds: false },
    blurb: 'Sees cars and houses (~1 m). Needs a very steady spacecraft and produces huge amounts of data.' },
  { id: 'optical-cube', name: 'Optical CubeCam', cap: 'optical', size: 'S', mass: 1.4, power: 6, cost: 0.8,
    data: 40, duty: 0.1, sci: 8, trl: 7, pointing: 0.2,
    img: { res500: 6, swath500: 25, night: false, clouds: false },
    blurb: 'A small telescope camera for CubeSats. Good enough to see villages and coastlines.' },
  { id: 'sar', name: 'Synthetic Aperture Radar', cap: 'radar', size: 'L', mass: 280, power: 2000, cost: 85,
    data: 240, duty: 0.12, sci: 40, trl: 8, pointing: 0.1,
    img: { res500: 8, swath500: 160, night: true, clouds: true },
    blurb: 'Sends its own microwave pulses, so it sees through clouds and darkness and can measure ground swelling.' },
  { id: 'neutron', name: 'Neutron Spectrometer', cap: 'neutron', size: 'M', mass: 10, power: 8, cost: 9,
    data: 0.004, duty: 1, sci: 30, trl: 9, pointing: 10,
    blurb: 'Counts neutrons leaking from the surface. Fewer fast neutrons means hydrogen, a clue for water ice.' },
  { id: 'neutron-mini', name: 'Miniature Neutron Spectrometer', cap: 'neutron', size: 'S', mass: 3.4, power: 8, cost: 2.2,
    data: 0.002, duty: 1, sci: 16, trl: 6, pointing: 10,
    blurb: 'A CubeSat-sized neutron detector. Less sensitive and less proven than the full-size version.' },
  { id: 'irspec', name: 'Infrared Spectrometer', cap: 'ir-spectro', size: 'M', mass: 22, power: 30, cost: 20,
    data: 15, duty: 0.3, sci: 28, trl: 8, pointing: 0.2,
    blurb: 'Splits reflected light into hundreds of colors to identify minerals, water and gases such as SO2.' },
  { id: 'altimeter', name: 'Laser Altimeter', cap: 'altimeter', size: 'M', mass: 18, power: 35, cost: 16,
    data: 0.3, duty: 1, sci: 22, trl: 9, pointing: 0.1,
    blurb: 'Fires laser pulses and times the echo to map terrain height, even inside dark craters.' },
  { id: 'magnetometer', name: 'Fluxgate Magnetometer', cap: 'magnetometer', size: 'S', mass: 1.5, power: 2, cost: 1.2,
    data: 0.006, duty: 1, sci: 18, trl: 9, pointing: 30,
    blurb: 'Measures the magnetic field carried by the solar wind. Its direction decides how hard a storm hits.' },
  { id: 'plasma', name: 'Solar Wind Plasma Analyzer', cap: 'plasma', size: 'M', mass: 12, power: 14, cost: 11,
    data: 0.03, duty: 1, sci: 24, trl: 9, pointing: 5,
    blurb: 'Measures the speed, density and temperature of the solar wind streaming past.' },
  { id: 'particles', name: 'Energetic Particle Detector', cap: 'particles', size: 'S', mass: 2.5, power: 4, cost: 2,
    data: 0.01, duty: 1, sci: 14, trl: 9, pointing: 30,
    blurb: 'Counts high-energy protons from solar flares, the radiation that threatens astronauts and satellites.' },
  { id: 'coronagraph', name: 'Coronagraph', cap: 'coronagraph', size: 'M', mass: 38, power: 28, cost: 32,
    data: 0.5, duty: 1, sci: 30, trl: 8, pointing: 0.02,
    blurb: 'Blocks the Sun with a small disk to photograph the faint corona and eruptions leaving the Sun.' },
  { id: 'iot', name: 'IoT Store-and-Forward Radio', cap: 'iot', size: 'S', mass: 0.9, power: 8, cost: 0.5,
    data: 0.05, duty: 1, sci: 30, trl: 8, pointing: 90,
    blurb: 'Collects short messages from sensors and phones on the ground and forwards them when it passes a station.' },
  { id: 'ais', name: 'AIS Ship-Tracking Receiver', cap: 'ais', size: 'S', mass: 0.7, power: 3, cost: 0.35,
    data: 0.03, duty: 1, sci: 20, trl: 9, pointing: 90,
    blurb: 'Listens to position beacons broadcast by ships. Helps spot illegal fishing and boats in distress.' },
];

export const SOLAR = [
  { id: 'sa-body', name: 'Body-mounted cells', cos: 0.3, trl: 9,
    blurb: 'Solar cells fixed to the spacecraft sides. No moving parts, but they rarely face the Sun squarely.',
    byBus: { cube6u: { area: 0.09, mass: 0.4, cost: 0.1 }, cube12u: { area: 0.13, mass: 0.6, cost: 0.15 },
      smallsat: { area: 0.9, mass: 5, cost: 0.8 } } },
  { id: 'sa-fixed', name: 'Deployable fixed wings', cos: 0.65, trl: 9,
    blurb: 'Panels that unfold after launch at a fixed angle. A good balance of power, mass and cost.',
    byBus: { cube6u: { area: 0.2, mass: 1.1, cost: 0.35 }, cube12u: { area: 0.3, mass: 1.6, cost: 0.5 },
      smallsat: { area: 1.4, mass: 9, cost: 1.6 }, medium: { area: 4, mass: 25, cost: 4 } } },
  { id: 'sa-track', name: 'Sun-tracking wings', cos: 0.95, trl: 9,
    blurb: 'Motorised wings that turn to face the Sun. The most power, at the highest mass and cost.',
    byBus: { cube6u: { area: 0.28, mass: 1.8, cost: 0.8 }, cube12u: { area: 0.45, mass: 2.6, cost: 1.1 },
      smallsat: { area: 2.4, mass: 16, cost: 3.5 }, medium: { area: 8, mass: 55, cost: 9 } } },
  { id: 'sa-xl', name: 'Large tracking wings', cos: 0.95, trl: 9,
    blurb: 'Huge wings for power-hungry payloads such as radar.',
    byBus: { medium: { area: 14, mass: 100, cost: 16 } } },
];

export const BATTERIES = [
  { id: 'bat-40', name: '40 Wh battery', wh: 40, mass: 0.35, cost: 0.04, buses: ['cube6u', 'cube12u'] },
  { id: 'bat-120', name: '120 Wh battery', wh: 120, mass: 1.0, cost: 0.1, buses: ['cube6u', 'cube12u', 'smallsat'] },
  { id: 'bat-500', name: '500 Wh battery', wh: 500, mass: 4.2, cost: 0.4, buses: ['smallsat'] },
  { id: 'bat-1500', name: '1.5 kWh battery', wh: 1500, mass: 12.5, cost: 1.1, buses: ['smallsat', 'medium'] },
  { id: 'bat-5000', name: '5 kWh battery', wh: 5000, mass: 41, cost: 3, buses: ['medium'] },
  { id: 'bat-15000', name: '15 kWh battery', wh: 15000, mass: 122, cost: 7, buses: ['medium'] },
];

// mass × scale, power × scale^0.6, cost × scale^0.8
export const ADCS = [
  { id: 'adcs-mtq', name: 'Magnetorquers + sun sensors', accuracy: 5, mass: 0.3, power: 1, cost: 0.04, trl: 9,
    earthFieldOnly: true, wheels: false,
    blurb: 'Electromagnets that push against Earth\'s magnetic field. Simple and cheap, but coarse, and useless far from Earth.' },
  { id: 'adcs-rw', name: 'Reaction wheels + sun sensors', accuracy: 0.5, mass: 1, power: 4, cost: 0.25, trl: 9,
    wheels: true,
    blurb: 'Spinning wheels turn the spacecraft precisely. Built-up spin must be dumped with magnetorquers near Earth, or thrusters elsewhere.' },
  { id: 'adcs-prec', name: 'Precision: wheels + star trackers', accuracy: 0.02, mass: 1.8, power: 7, cost: 0.7, trl: 9,
    wheels: true,
    blurb: 'Star cameras tell the spacecraft exactly where it points. Needed for sharp cameras, coronagraphs and narrow radio beams.' },
];

// dry × scale, cost × scale^0.8, power × scale^0.5 (heaters) or × scale^0.75 (electric thrusting)
export const PROPULSION = [
  { id: 'prop-none', name: 'No propulsion', isp: 0, dry: 0, power: 0, cost: 0, maxPropFrac: 0, trl: 9,
    blurb: 'Lighter and cheaper, but you can never change orbit, dodge debris, or deorbit at the end.' },
  { id: 'prop-cold', name: 'Cold-gas thrusters', isp: 65, dry: 0.5, power: 1, cost: 0.15, maxPropFrac: 0.06, trl: 9,
    blurb: 'Squirts compressed gas. Very safe and simple, but only enough push for small corrections.' },
  { id: 'prop-mono', name: 'Monopropellant thrusters', isp: 220, dry: 1.2, power: 2, cost: 0.5, maxPropFrac: 0.3, trl: 9,
    blurb: 'Fuel decomposes over a hot catalyst. The workhorse for station-keeping and avoidance moves.' },
  { id: 'prop-biprop', name: 'Bipropellant engine', isp: 315, dry: 1.6, power: 3, cost: 0.6, maxPropFrac: 0.45, trl: 9,
    buses: ['smallsat', 'medium'],
    blurb: 'Fuel and oxidizer burn together. Strong and efficient enough to brake into orbit around the Moon.' },
  { id: 'prop-electric', name: 'Electric (ion / Hall) thruster', isp: 1600, dry: 1.5, power: 20, powerDuty: 0.15, cost: 0.8,
    maxPropFrac: 0.15, trl: 8, lowThrust: true,
    blurb: 'Accelerates charged gas with electricity. Ten times more fuel-efficient, but the push is gentle and it eats power.' },
];

// Rates in Mbps by distance class. Deep-space rates (moon, l1) assume a Deep Space Network dish.
export const RADIOS = [
  { id: 'rad-uhf', name: 'UHF radio', band: 'UHF', rates: { leo: 0.0096, geo: 0, moon: 0, l1: 0 }, mass: 0.25, power: 4,
    cost: 0.03, pointing: 90, trl: 9,
    blurb: 'Amateur-style radio with a whip antenna. Works anywhere in low orbit, but only a trickle of data.' },
  { id: 'rad-s', name: 'S-band transceiver', band: 'S', rates: { leo: 2, geo: 0.5, moon: 0.1, l1: 0.02 }, mass: 1.2, power: 14,
    cost: 0.35, pointing: 30, trl: 9,
    blurb: 'The standard command-and-telemetry radio. Reliable, wide beam, modest data rate.' },
  { id: 'rad-x', name: 'X-band transmitter', band: 'X', rates: { leo: 100, geo: 10, moon: 1, l1: 0.05 }, mass: 3, power: 30,
    cost: 1.2, pointing: 5, trl: 9,
    blurb: 'A higher frequency, faster link for science data. Must roughly point at the ground station.' },
  { id: 'rad-hga', name: 'X-band high-gain dish', band: 'X', rates: { leo: 300, geo: 40, moon: 15, l1: 0.5 }, mass: 22, power: 70,
    cost: 9, pointing: 0.2, trl: 9, buses: ['smallsat', 'medium'],
    blurb: 'A 1 m steerable dish focuses the signal into a tight beam, which matters most over long distances.' },
  { id: 'rad-ka', name: 'Ka-band high-rate system', band: 'Ka', rates: { leo: 1500, geo: 150, moon: 100, l1: 6 }, mass: 28,
    power: 110, cost: 12, pointing: 0.1, trl: 8, buses: ['smallsat', 'medium'],
    blurb: 'Very high frequency with its own dish. Huge data rates, but heavy rain can block it.' },
];

export const NETWORKS = [
  { id: 'single', name: 'Single station: Surabaya', bands: ['UHF', 'S', 'X'], setup: 0.6, perYear: 0.15, deepSpace: false,
    blurb: 'One 5 m dish on a university campus in Surabaya (7.3° S). Cheap, but it only sees you when you fly overhead.' },
  { id: 'commercial', name: 'Commercial network: 12 stations', bands: ['UHF', 'S', 'X', 'Ka'], setup: 0.2, perYear: 1.2, deepSpace: false,
    blurb: 'Rent antenna time worldwide, including polar sites that see sun-synchronous satellites every orbit.' },
  { id: 'dsn', name: 'NASA Deep Space Network', bands: ['S', 'X', 'Ka'], setup: 0, perYear: 3.5, deepSpace: true,
    blurb: 'Giant 34 m and 70 m dishes in California, Spain and Australia, about 120° apart, so a deep-space craft is always in view of one.' },
];

export const OPS = [
  { id: 'ops-lean', name: 'Lean team', people: '2 people, office hours', perYear: 0.2, recovery: 0.35,
    blurb: 'Cheap, but slow to react when something breaks at 3 a.m.' },
  { id: 'ops-standard', name: 'Standard team', people: '8 people, on-call', perYear: 1.5, recovery: 0.7,
    blurb: 'Enough engineers to plan daily operations and fix most anomalies.' },
  { id: 'ops-full', name: 'Full flight team', people: '25 people, 24/7', perYear: 5, recovery: 0.9,
    blurb: 'Round-the-clock mission control. Expensive, but almost every problem gets solved.' },
];

// Capacities (kg) by launch class. Rideshare cost is per kg: base + perKg × mass (× deepMult for deep space).
export const LAUNCHERS = [
  { id: 'lv-rideshare', name: 'Rideshare slot', caps: { leo: 300, sso: 300, gto: 0, deep: 25 }, cost: null,
    rideshare: { base: 0.25, perKg: 0.009, deepMult: 3 }, reliability: 0.97, buses: ['cube6u', 'cube12u', 'smallsat'],
    examples: 'SpaceX Transporter missions; CubeSats on NASA\'s Artemis I',
    blurb: 'Share a rocket with other payloads. Very cheap, but you go where the main passenger goes.' },
  { id: 'lv-small', name: 'Small launcher', caps: { leo: 320, sso: 230, gto: 0, deep: 35 }, cost: 8.5, reliability: 0.94,
    examples: 'Rocket Lab Electron (it sent NASA\'s CAPSTONE CubeSat to the Moon)',
    blurb: 'A dedicated ride for small satellites: your orbit, your schedule.' },
  { id: 'lv-medium', name: 'Medium launcher', caps: { leo: 3800, sso: 1750, gto: 1400, deep: 600 }, cost: 31, reliability: 0.96,
    examples: 'ISRO PSLV (it launched Indonesia\'s LAPAN-A2 and India\'s Chandrayaan-1)',
    blurb: 'A proven mid-size rocket for Earth-observation satellites and small planetary probes.' },
  { id: 'lv-mediumheavy', name: 'Medium-heavy launcher', caps: { leo: 17000, sso: 12000, gto: 5500, deep: 3500 }, cost: 70,
    reliability: 0.99, examples: 'SpaceX Falcon 9; JAXA H3',
    blurb: 'Carries large spacecraft to any orbit, including toward the Moon and L1.' },
  { id: 'lv-heavy', name: 'Heavy launcher', caps: { leo: 50000, sso: 30000, gto: 16000, deep: 13000 }, cost: 150,
    reliability: 0.97, examples: 'SpaceX Falcon Heavy; ESA Ariane 6; NASA SLS',
    blurb: 'Massive capacity for flagship missions. Overkill and very expensive for most.' },
];

export const LAUNCH_CLASS_LABEL = { leo: 'low Earth orbit', sso: 'sun-synchronous orbit', gto: 'geostationary transfer', deep: 'the Moon / L1' };

// contact = minutes of ground contact per day by network; passes = passes per day over Indonesia.
export const ORBITS = [
  { id: 'leo-iss', name: 'ISS-like low orbit', short: 'LEO 400 km · 51.6°', body: 'earth', alt: 400, inc: 51.6,
    launchClass: 'leo', commsClass: 'leo', lighting: 'varied', natLife: 1.5, dvPerYear: 35, insertionDv: 0, deorbitDv: 0,
    radDose: 0.35, passes: 4.5, contact: { single: 25, commercial: 110, dsn: 0 },
    blurb: 'Cheap to reach and close to Earth, but thin air drags you down within about 18 months without thrusters.' },
  { id: 'sso-550', name: 'Sun-synchronous orbit', short: 'SSO 550 km · 97.6°', body: 'earth', alt: 550, inc: 97.6, sso: true,
    launchClass: 'sso', commsClass: 'leo', lighting: 'morning', natLife: 6, dvPerYear: 4, insertionDv: 0, deorbitDv: 0,
    radDose: 0.5, passes: 4, contact: { single: 30, commercial: 200, dsn: 0 },
    blurb: 'Passes over every place at the same local time (about 10:30) with consistent lighting. The Earth-observation favorite.' },
  { id: 'sso-dd-750', name: 'Dawn–dusk sun-synchronous', short: 'SSO 750 km · dawn–dusk', body: 'earth', alt: 750, inc: 98.4,
    sso: true, launchClass: 'sso', commsClass: 'leo', lighting: 'terminator', eclipseOverride: 20, cyclesPerYear: 1300,
    natLife: 60, dvPerYear: 1, insertionDv: 0, deorbitDv: 120, radDose: 0.8, passes: 4,
    contact: { single: 40, commercial: 230, dsn: 0 },
    blurb: 'Rides the day–night line, so it is almost always in sunlight. Great for radar, poor light for cameras, and it stays up for decades.' },
  { id: 'leo-eq-550', name: 'Near-equatorial low orbit', short: 'LEO 550 km · 6°', body: 'earth', alt: 550, inc: 6,
    launchClass: 'leo', commsClass: 'leo', lighting: 'varied', natLife: 6, dvPerYear: 4, insertionDv: 0, deorbitDv: 0,
    radDose: 0.4, passes: 15, contact: { single: 140, commercial: 150, dsn: 0 },
    blurb: 'Circles close to the equator, passing over Indonesia on nearly every orbit, but it never sees latitudes beyond about 6°.' },
  { id: 'geo', name: 'Geostationary orbit', short: 'GEO 35,786 km over 108° E', body: 'earth', alt: 35786, inc: 0,
    launchClass: 'gto', commsClass: 'geo', lighting: 'continuous', natLife: 1, dvPerYear: 50, insertionDv: 1500,
    deorbitDv: 11, radDose: 2, passes: Infinity, contact: { single: 1440, commercial: 1440, dsn: 0 },
    blurb: 'Hovers over one spot, seeing Indonesia nonstop. But it is 65× farther than LEO, and rockets only drop you in a transfer orbit.' },
  { id: 'lunar-100', name: 'Low lunar polar orbit', short: 'Moon · 100 km polar', body: 'moon', alt: 100, inc: 90,
    launchClass: 'deep', commsClass: 'moon', lighting: 'varied', natLife: 0.5, dvPerYear: 60, insertionDv: 900, deorbitDv: 0,
    radDose: 1.5, passes: 0, contact: { single: 0, commercial: 0, dsn: 480 }, transitDays: 5,
    blurb: 'Flies over both lunar poles every 2 hours. Uneven lunar gravity ("mascons") bends the orbit, so it needs regular corrections.' },
  { id: 'l1-halo', name: 'Sun–Earth L1 halo orbit', short: 'L1 · 1.5 million km sunward', body: 'l1', alt: 1500000, inc: 0,
    launchClass: 'deep', commsClass: 'l1', lighting: 'continuous', eclipseOverride: 0, cyclesPerYear: 0,
    natLife: 0.3, dvPerYear: 5, insertionDv: 40, deorbitDv: 0, radDose: 1, passes: 0,
    contact: { single: 0, commercial: 0, dsn: 480 }, transitDays: 110,
    blurb: 'A balance point between Earth and Sun. Solar wind passes here about an hour before reaching Earth. Unstable: you must keep nudging.' },
];

export const CATALOG = {
  buses: BUSES, instruments: INSTRUMENTS, solar: SOLAR, batteries: BATTERIES, adcs: ADCS,
  propulsion: PROPULSION, radios: RADIOS, networks: NETWORKS, ops: OPS, launchers: LAUNCHERS, orbits: ORBITS,
};

const index = {};
for (const [group, list] of Object.entries(CATALOG)) {
  index[group] = Object.fromEntries(list.map((item) => [item.id, item]));
}

export function get(group, id) {
  if (!id) return null;
  return index[group]?.[id] ?? null;
}

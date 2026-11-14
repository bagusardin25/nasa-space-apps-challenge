// Small, transparent physics models. Each one is simplified on purpose so it can be explained in the game.

export const MU_EARTH = 398600.4418; // km^3/s^2
export const R_EARTH = 6378.137; // km
export const MU_MOON = 4902.8; // km^3/s^2
export const R_MOON = 1737.4; // km
export const SOLAR_CONSTANT = 1361; // W/m^2 at 1 AU
export const CELL_EFFICIENCY = 0.295; // triple-junction solar cells
export const G0 = 9.80665; // m/s^2
export const EARTH_CIRCUMFERENCE = 40075; // km
export const KM_PER_DEG = 111.32;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Kepler's third law: T = 2π √(a³ / μ). */
export function orbitalPeriodSec(altKm, body = 'earth') {
  const [mu, r] = body === 'moon' ? [MU_MOON, R_MOON] : [MU_EARTH, R_EARTH];
  const a = r + altKm;
  return 2 * Math.PI * Math.sqrt(a ** 3 / mu);
}

/** Worst-case (Sun in the orbit plane) fraction of a circular orbit spent in the planet's shadow. */
export function eclipseFraction(altKm, body = 'earth') {
  const r = body === 'moon' ? R_MOON : R_EARTH;
  return Math.asin(r / (r + altKm)) / Math.PI;
}

/** Tsiolkovsky rocket equation, returns m/s. */
export function rocketDeltaV(isp, wetKg, dryKg) {
  if (!isp || wetKg <= dryKg || dryKg <= 0) return 0;
  return isp * G0 * Math.log(wetKg / dryKg);
}

/** Propellant needed for a delta-v, given the dry mass. */
export function propellantFor(dv, isp, dryKg) {
  if (!isp || dv <= 0) return 0;
  return dryKg * (Math.exp(dv / (isp * G0)) - 1);
}

/** Lithium-ion cycle life falls steeply as each cycle drains the battery deeper. */
export function cycleLife(depthOfDischarge) {
  const dod = clamp(depthOfDischarge, 0.05, 1);
  return 2000 * Math.pow(0.8 / dod, 1.8);
}

/**
 * Solar array power needed to run the load in sunlight AND recharge the battery for eclipse
 * (the classic sizing equation from Space Mission Analysis and Design, with path efficiencies 0.65 / 0.85).
 */
export function requiredArrayPower(loadW, eclipseMin, sunlitMin) {
  if (eclipseMin <= 0 || sunlitMin <= 0) return loadW / 0.85;
  return (loadW * eclipseMin / 0.65 + loadW * sunlitMin / 0.85) / sunlitMin;
}

export function arrayPowerBOL(areaM2, cosFactor) {
  return areaM2 * SOLAR_CONSTANT * CELL_EFFICIENCY * cosFactor;
}

/** Derived orbit parameters used by the mission model. */
export function orbitInfo(orbit) {
  if (orbit.body === 'l1') {
    return { periodMin: 178 * 1440, eclipseMin: 0, sunlitMin: 178 * 1440, orbitsPerDay: 0, cyclesPerYear: 0, eclipseFrac: 0 };
  }
  const periodMin = orbitalPeriodSec(orbit.alt, orbit.body) / 60;
  const eclipseMin = orbit.eclipseOverride ?? periodMin * eclipseFraction(orbit.alt, orbit.body);
  const orbitsPerDay = 1440 / periodMin;
  const cyclesPerYear = orbit.cyclesPerYear ?? (orbit.id === 'geo' ? 90 : orbitsPerDay * 365);
  return {
    periodMin,
    eclipseMin,
    sunlitMin: periodMin - eclipseMin,
    orbitsPerDay,
    cyclesPerYear,
    eclipseFrac: eclipseMin / periodMin,
  };
}

/**
 * Ground resolution, swath and revisit time of an imager over a target latitude.
 * Resolution and swath scale with altitude (same optics, farther away).
 */
export function imagingGeometry(img, orbit, info, targetLat, count = 1) {
  const res = img.res500 * orbit.alt / 500;
  const swath = img.swath500 * orbit.alt / 500;
  const lat = Math.abs(targetLat);
  if (orbit.body !== 'earth') return { res, swath, revisit: null, covered: true };
  if (orbit.id === 'geo') {
    return { res, swath, revisit: lat < 70 ? 10 / 1440 : Infinity, covered: lat < 70 };
  }
  const halfSwathDeg = swath / 2 / KM_PER_DEG;
  const incEff = orbit.inc > 90 ? 180 - orbit.inc : orbit.inc;
  if (lat > incEff + halfSwathDeg) return { res, swath, revisit: Infinity, covered: false };
  const n = info.orbitsPerDay;
  let revisit;
  if (incEff < 20) {
    // Low-inclination orbits sweep every longitude each orbit, so a covered target is passed most orbits.
    const frac = clamp((2 * halfSwathDeg) / (2 * Math.max(incEff, 0.5)), 0.1, 1);
    revisit = 1 / (n * frac * (img.night ? 1 : 0.5));
  } else {
    const passFactor = img.night ? 2 : 1;
    const spacing = EARTH_CIRCUMFERENCE * Math.cos(lat * Math.PI / 180) / n;
    const floor = orbit.sso ? 1 / passFactor : 0.5 / passFactor;
    revisit = Math.max(floor, spacing / (swath * passFactor));
  }
  return { res, swath, revisit: revisit / count, covered: true };
}

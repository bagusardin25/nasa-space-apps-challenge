// Minimal stroke icon set (24 × 24, currentColor). Hand-drawn for this project.
const P = {
  flask: '<path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  rocket: '<path d="M12 2c3.5 2.5 5 6 5 10l-2 4H9l-2-4c0-4 1.5-7.5 5-10z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M9 16l-2.5 3.5M15 16l2.5 3.5M12 17v4"/>',
  satellite: '<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M3 5l4 4M3 9l2-2M17 15l4 4M19 15l2 2"/><path d="M9 9L5 5M15 15l4 4"/><path d="M15 9l3-3M9 15l-3 3"/>',
  dish: '<path d="M4 10a8 8 0 0 0 10 10L4 10z"/><path d="M9 15l5-5"/><circle cx="15" cy="9" r="1.5"/><path d="M17 4a5 5 0 0 1 3 3M16.5 1.5a8 8 0 0 1 6 6"/><path d="M7 21h6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  weight: '<path d="M6 8h12l2 12H4L6 8z"/><circle cx="12" cy="5" r="2"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.6-2.3-2.8-5.4-3"/>',
  database: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  signal: '<path d="M2 12a10 10 0 0 1 20 0"/><path d="M6 12a6 6 0 0 1 12 0"/><circle cx="12" cy="12" r="2"/><path d="M12 14v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gauge: '<path d="M3.5 17a9 9 0 1 1 17 0"/><path d="M12 13l4-5"/><circle cx="12" cy="13" r="1.5"/>',
  thruster: '<path d="M8 3h8l-1 9H9L8 3z"/><path d="M9 12l-2 5h10l-2-5"/><path d="M10 19l-1 3M14 19l1 3M12 19v3"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4V4z"/><path d="M20 4h-4a3 3 0 0 0-3 3"/><path d="M20 4v15h-5"/>',
  play: '<path d="M7 4l13 8-13 8V4z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  forward: '<path d="M3 5l8 7-8 7V5zM12 5l8 7-8 7V5z"/>',
  skip: '<path d="M5 5l10 7-10 7V5z"/><path d="M19 5v14"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M5 9l7 7 7-7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.7c2.4.8 4 3 4 6.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5"/>',
  volcano: '<path d="M2 21l6.5-10h7L22 21H2z"/><path d="M8.5 11l1.5-3h4l1.5 3"/><path d="M11 5c0-1.5 1-2.5 2-3M13.5 5.5c.5-1.2 1.6-1.8 2.8-1.8"/>',
  islands: '<path d="M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M5 15c1-3 3-4.5 5-4.5s3.5 1.5 4 4.5"/><path d="M15 14c.6-1.8 1.8-3 3.5-3s2.5 1.2 3 3"/><path d="M9.5 10.5V6M9.5 6c-1.5-1-3.5-1-4.5 0M9.5 6c1.5-1 3.5-1 4.5 0"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4"/><path d="M12 13v4M8 21h8M10 17h4"/>',
  wand: '<path d="M4 20L16 8"/><path d="M15 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6L19 11z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
};

export function icon(name, { size = 18, label = null, cls = '' } = {}) {
  const body = P[name] ?? P.info;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}

export const ROLE_ICON = { science: 'flask', launch: 'rocket', spacecraft: 'satellite', ground: 'dish', mission: 'flag' };

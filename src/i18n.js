// Bilingual support: English (default, required for the Space Apps submission) and Bahasa Indonesia.
// Usage: tx('English text', 'Teks Indonesia'). Data objects carry Indonesian fields in `idn`.
import { ID_TEXT, ID_CAPS, ID_LAUNCH_CLASS } from './data/i18n-id.js';

const KEY = 'gonogo.lang';
let lang = 'en';
try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (saved === 'id' || saved === 'en') lang = saved;
} catch {
  /* storage unavailable: stay in English */
}

export const getLang = () => lang;

export function setLang(next) {
  lang = next === 'id' ? 'id' : 'en';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Pick the string for the current language. */
export const tx = (en, id) => (lang === 'id' && id != null ? id : en);

/** Localized field of a data object that stores Indonesian text in `obj.idn`. */
export const loc = (obj, field) => (lang === 'id' && obj?.idn?.[field] != null ? obj.idn[field] : obj?.[field]);

/** Catalog items and roles keep Indonesian text in ID_TEXT keyed by id. */
export const nameOf = (item) => (item ? (lang === 'id' && ID_TEXT[item.id]?.name) || item.name : '');
export const blurbOf = (item) => (item ? (lang === 'id' && ID_TEXT[item.id]?.blurb) || item.blurb : '');
export const fieldOf = (item, field) => (item ? (lang === 'id' && ID_TEXT[item.id]?.[field]) || item[field] : '');
/** Name for use mid-sentence. Indonesian keeps proper nouns (Matahari, Bulan) capitalized. */
export const inlineName = (item) => {
  const n = nameOf(item);
  return lang === 'id' ? n.charAt(0).toLowerCase() + n.slice(1) : n.toLowerCase();
};
export const capLabel =(cap, enLabel) => (lang === 'id' && ID_CAPS[cap]) || enLabel || cap;
export const launchClassLabel = (cls, enLabel) => (lang === 'id' && ID_LAUNCH_CLASS[cls]) || enLabel || cls;

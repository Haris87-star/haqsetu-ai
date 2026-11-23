// Pure persistence and tracker helpers. No DOM, no network. Imports nothing from engine.js.
export const TRACKER_STATUSES = ['Not Started', 'In Progress', 'Submitted', 'Completed'];
const LEGACY_TRACKER_STATUS = { Preparing: 'In Progress', Applied: 'Submitted', 'Under Review': 'Submitted', Approved: 'Completed', Rejected: 'Submitted' };
export function normalizeTrackerStatus(status) {
  if (TRACKER_STATUSES.includes(status)) return status;
  return LEGACY_TRACKER_STATUS[status] || 'Not Started';
}
export function documentProgress(scheme, entry) {
  const total = Array.isArray(scheme?.documents) ? scheme.documents.length : 0;
  const checked = (Array.isArray(entry?.checked) ? entry.checked : []).filter((i) => Number.isInteger(i) && i >= 0 && i < total);
  const unique = new Set(checked).size;
  return { checked: unique, total, percent: total ? Math.round((unique / total) * 100) : 0 };
}
export const SESSION_FORM_KEYS = ['state', 'age', 'income', 'level'];
const SESSION_MAX_TEXT = 2000;
export function sanitizeSession(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const inForm = src.form && typeof src.form === 'object' ? src.form : {};
  const form = {};
  for (const k of SESSION_FORM_KEYS) form[k] = typeof inForm[k] === 'string' ? inForm[k].slice(0, 60) : '';
  return {
    story: typeof src.story === 'string' ? src.story.slice(0, SESSION_MAX_TEXT) : '',
    form,
    resultsShown: src.resultsShown === true,
    savedAt: typeof src.savedAt === 'string' ? src.savedAt : null,
  };
}
export function parseSession(text) {
  try { return sanitizeSession(JSON.parse(text)); } catch { return sanitizeSession({}); }
}
export function profileSignature(form, story) {
  const f = form && typeof form === 'object' ? form : {};
  return JSON.stringify([SESSION_FORM_KEYS.map((k) => String(f[k] ?? '').trim()), String(story ?? '').trim()]);
}
export function isResultOutdated(shownSignature, currentSignature) {
  if (shownSignature == null) return false;
  return shownSignature !== currentSignature;
}

// ---------- versioned session schema (v2) and erase helper ----------
export const SESSION_VERSION = 2;
export const SESSION_STORAGE_KEYS = ['haqsetu-session', 'haqsetu-tracker'];
const SENSITIVE_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b(?:otp|password|passcode)\b\s*[:=]?\s*\S+/gi,
];
export function maskSensitiveIds(text) {
  let out = String(text ?? '');
  for (const rx of SENSITIVE_PATTERNS) out = out.replace(rx, '[removed]');
  return out;
}
function cleanForm(f) {
  const src = f && typeof f === 'object' ? f : {};
  const out = {};
  for (const k of SESSION_FORM_KEYS) out[k] = typeof src[k] === 'string' ? src[k].slice(0, 60) : '';
  return out;
}
export function buildSession({ story = '', form = {}, confirmedForm = null, savedAt = null } = {}) {
  return {
    version: SESSION_VERSION,
    story: maskSensitiveIds(story).slice(0, SESSION_MAX_TEXT),
    form: cleanForm(form),
    confirmedForm: confirmedForm && typeof confirmedForm === 'object' ? cleanForm(confirmedForm) : null,
    savedAt: typeof savedAt === 'string' ? savedAt : null,
  };
}
export function readVersionedSession(text) {
  const empty = buildSession({});
  let obj;
  try { obj = JSON.parse(text); } catch { return empty; }
  if (!obj || typeof obj !== 'object' || obj.version !== SESSION_VERSION) return empty;
  return buildSession({ story: obj.story, form: obj.form, confirmedForm: obj.confirmedForm, savedAt: obj.savedAt });
}
export function eraseDemoData(storage, keys = SESSION_STORAGE_KEYS) {
  for (const k of keys) storage.removeItem(k);
  return keys.length;
}


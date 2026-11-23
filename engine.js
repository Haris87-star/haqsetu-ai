// HaqSetu AI — deterministic engine. Plain ES module, no npm dependencies, no network.
// Kannada strings are machine-drafted and need native review.
const DAY_MS = 86400000;
const STATUSES = ['interested', 'checklist_in_progress', 'submitted', 'approved', 'rejected', 'withdrawn'];
const CLOSED = ['withdrawn', 'rejected', 'approved'];
const GROUP_RANK = { eligible: 0, more_info_needed: 1, not_eligible: 2 };
const HELP_SUGGESTIONS = ['Am I eligible?', 'What documents do I need?', 'How do I apply?', 'Is there a deadline?'];

// ---------- helpers ----------
const isMissing = (v) => v === undefined || v === null || v === '';
const norm = (v) => String(v).trim().toLowerCase();
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function asNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}
function truthyValue(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['yes', 'true', 'y', '1'].includes(norm(v));
  return Boolean(v);
}
const FIELD_NAMES = {
  age: 'age', annual_income: 'annual income', state: 'state', gender: 'gender',
  caste_category: 'caste category', education: 'education', occupation: 'occupation',
  is_disabled: 'disability status', is_student: 'student status', is_widow: 'widow status',
  has_bpl_card: 'BPL card', land_acres: 'land holding', residence: 'residence',
};
const fieldName = (f) => FIELD_NAMES[f] ?? String(f);
const fmtNum = (n) => Number(n).toLocaleString('en-IN');
function fmtValue(field, v) {
  if (field === 'annual_income' && typeof v === 'number') return `₹${fmtNum(v)}`;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}
const listText = (values) => (Array.isArray(values) ? values : [values]).map(String).join(', ');

// ---------- rule evaluation ----------
function evaluateRule(rule, profile) {
  const field = rule.field;
  const f = fieldName(field);
  const reqWord = rule.required ? 'required' : 'optional';
  const labelKn = rule.label_kn || rule.label_en || '';
  const value = profile[field];
  if (isMissing(value)) {
    return {
      result: 'missing',
      detail_en: `We need your ${f} to check this rule (${reqWord}).`,
      // Kannada: machine-drafted, needs native review.
      detail_kn: `ಈ ನಿಯಮ ಪರಿಶೀಲಿಸಲು ಇನ್ನಷ್ಟು ಮಾಹಿತಿ ಬೇಕು: ${labelKn}`,
    };
  }
  const rv = rule.value;
  const shown = fmtValue(field, value);
  let pass = false;
  let en = '';
  switch (rule.op) {
    case 'eq':
      pass = norm(value) === norm(rv);
      en = pass ? `Your ${f} is ${shown}, as required` : `Your ${f} is ${shown}, but ${fmtValue(field, rv)} is required`;
      break;
    case 'in': {
      const list = Array.isArray(rv) ? rv : [rv];
      pass = list.some((x) => norm(x) === norm(value));
      en = pass ? `Your ${f} ${shown} is one of: ${listText(list)}` : `Your ${f} ${shown} is not one of: ${listText(list)}`;
      break;
    }
    case 'lte': {
      const n = asNumber(value);
      const lim = asNumber(rv);
      if (Number.isNaN(n) || Number.isNaN(lim)) { pass = false; en = `Your ${f} cannot be compared with the limit`; break; }
      pass = n <= lim;
      en = pass
        ? `Your ${f} ${fmtValue(field, n)} is within the limit of ${fmtValue(field, lim)}`
        : `Your ${f} ${fmtValue(field, n)} is above the limit of ${fmtValue(field, lim)}`;
      break;
    }
    case 'gte': {
      const n = asNumber(value);
      const lim = asNumber(rv);
      if (Number.isNaN(n) || Number.isNaN(lim)) { pass = false; en = `Your ${f} cannot be compared with the minimum`; break; }
      pass = n >= lim;
      en = pass
        ? `Your ${f} ${fmtValue(field, n)} meets the minimum of ${fmtValue(field, lim)}`
        : `Your ${f} ${fmtValue(field, n)} is below the minimum of ${fmtValue(field, lim)}`;
      break;
    }
    case 'between': {
      const n = asNumber(value);
      const [min, max] = Array.isArray(rv) ? rv : [NaN, NaN];
      if ([n, min, max].some(Number.isNaN)) { pass = false; en = `Your ${f} cannot be compared with the range`; break; }
      pass = n >= min && n <= max;
      en = pass
        ? `Your ${f} ${n} is within ${min}–${max}`
        : `Your ${f} ${n} is outside ${min}–${max}`;
      break;
    }
    case 'truthy':
      pass = truthyValue(value);
      en = pass ? `Confirmed: ${f}` : `Not confirmed: ${f}`;
      break;
    case 'includes':
      pass = Array.isArray(value)
        ? value.some((x) => norm(x) === norm(rv))
        : norm(value).includes(norm(rv));
      en = pass ? `Your ${f} includes ${rv}` : `Your ${f} does not include ${rv}`;
      break;
    case 'state_in': {
      const list = Array.isArray(rv) ? rv : [rv];
      pass = list.some((x) => norm(x) === norm(value));
      en = pass
        ? `Your state ${shown} is supported by this scheme`
        : `Your state ${shown} is not in this scheme's supported list (${listText(list)})`;
      break;
    }
    default:
      pass = false;
      en = `Rule type "${rule.op}" is not supported`;
  }
  return {
    result: pass ? 'pass' : 'fail',
    detail_en: `${en} (${reqWord})`,
    // Kannada: machine-drafted, needs native review.
    detail_kn: `${pass ? 'ಹೊಂದುತ್ತದೆ' : 'ಹೊಂದುವುದಿಲ್ಲ'}: ${labelKn}`,
  };
}

export function evaluateScheme(scheme, profile) {
  if (!scheme || typeof scheme !== 'object') {
    return { scheme_id: null, scheme_name_en: '', scheme_name_kn: '', status: 'more_info_needed', score: 0, checks: [] };
  }
  try {
    const prof = profile && typeof profile === 'object' ? profile : {};
    const rules = Array.isArray(scheme?.rules) ? scheme.rules : [];
    const checks = rules.map((rule) => {
      const r = evaluateRule(rule, prof);
      return {
        rule_id: rule.id,
        field: rule.field,
        label_en: rule.label_en,
        label_kn: rule.label_kn,
        result: r.result,
        detail_en: r.detail_en,
        detail_kn: r.detail_kn,
        required: Boolean(rule.required),
      };
    });
    const passed = checks.filter((c) => c.result === 'pass').length;
    const score = checks.length ? passed / checks.length : 0;
    const requiredFail = checks.some((c) => c.required && c.result === 'fail');
    const requiredMissing = checks.some((c) => c.required && c.result === 'missing');
    const status = requiredFail ? 'not_eligible' : requiredMissing ? 'more_info_needed' : 'eligible';
    return {
      scheme_id: scheme?.id ?? null,
      scheme_name_en: scheme?.name_en ?? '',
      scheme_name_kn: scheme?.name_kn ?? '',
      status,
      score,
      checks,
    };
  } catch {
    return { scheme_id: null, scheme_name_en: '', scheme_name_kn: '', status: 'more_info_needed', score: 0, checks: [] };
  }
}

// Kept for backward compatibility: matchScheme(profile, scheme) now returns evaluateScheme's result.
export function matchScheme(profile, scheme) {
  return evaluateScheme(scheme, profile);
}

export function matchAll(profile, catalog) {
  const list = Array.isArray(catalog) ? catalog : [];
  return list
    .map((s, i) => ({ res: evaluateScheme(s, profile), i }))
    .sort((a, b) =>
      GROUP_RANK[a.res.status] - GROUP_RANK[b.res.status] ||
      b.res.score - a.res.score ||
      a.i - b.i)
    .map((x) => x.res);
}

export function searchSchemes(catalog, options = {}) {
  const list = Array.isArray(catalog) ? catalog : [];
  const opts = options && typeof options === 'object' ? options : {};
  const words = typeof opts.query === 'string' ? opts.query.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];
  const cat = typeof opts.category === 'string' ? opts.category.trim().toLowerCase() : '';
  const wantStatus = typeof opts.status === 'string' ? opts.status : '';
  let statusById = null;
  if (wantStatus) {
    statusById = new Map(matchAll(opts.profile ?? {}, list).map((r) => [r.scheme_id, r.status]));
  }
  return list.filter((s) => {
    if (!s || typeof s !== 'object') return false;
    if (cat && String(s.category ?? '').toLowerCase() !== cat) return false;
    if (words.length) {
      const hay = [s.name_en, s.name_kn, s.summary_en, s.summary_kn, s.category, ...(Array.isArray(s.tags) ? s.tags : [])]
        .map((x) => String(x ?? '').toLowerCase());
      if (!words.every((w) => hay.some((h) => h.includes(w)))) return false;
    }
    if (wantStatus && statusById.get(s.id) !== wantStatus) return false;
    return true;
  });
}

export function buildChecklist(scheme, profile, lang = 'en') {
  const prof = profile && typeof profile === 'object' ? profile : {};
  const docs = Array.isArray(scheme?.documents) ? scheme.documents : [];
  return docs.map((d) => {
    const doc_en = typeof d === 'string' ? d : String(d?.en ?? '');
    const doc_kn = typeof d === 'string' ? d : String(d?.kn ?? doc_en);
    const possibly =
      (truthyValue(prof.has_bpl_card) && /\bbpl\b|ration/i.test(doc_en)) ||
      (!isMissing(prof.residence) && /address|residence/i.test(doc_en)) ||
      (truthyValue(prof.is_widow) && /death certificate|spouse/i.test(doc_en)) ||
      (truthyValue(prof.is_disabled) && /disability/i.test(doc_en)) ||
      (asNumber(prof.land_acres) > 0 && /land/i.test(doc_en));
    return { doc_en, doc_kn, doc: lang === 'kn' ? doc_kn : doc_en, status: possibly ? 'possibly_have' : 'needed' };
  });
}

// ---------- profile extraction ----------
const STATE_NAMES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
const STATE_RX = STATE_NAMES.map((name) => ({
  state: name,
  rx: new RegExp(`\\b${name.split(' ').map(escapeRe).join('\\s+')}\\b`, 'i'),
}));
// City and Kannada aliases resolve to their state.
STATE_RX.push({ state: 'Karnataka', rx: /\bbangalore\b|\bbengaluru\b|\bmysuru\b|\bmysore\b|\bmangaluru\b|\bmangalore\b|ಕರ್ನಾಟಕ/i });

const AGE_RX = [
  /\b(?:i\s*am|i'?m|im)\s+(?<![\d.,])(\d{1,3})\b(?![.,]\d)(?!\s*(?:%|per\s*cent|percent|percentage|lakhs?|lacs?|rs\b|₹|inr|acres?|marks?|rupees?))/i,
  /(?<![\d.,])\b(\d{1,3})[\s-]*(?:years?|yrs?)[\s-]*old\b/i,
  /\b(?:age|aged)\s*[:=]?\s*(?<![\d.,])(\d{1,3})\b/i,
];

const MONEY_SRC = /(₹|\brs\.?|\binr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|thousand|k)?\b/.source;

const INCOME_CTX_RX = /income|earn|salary|wage|family|annual|yearly|per\s+(?:year|month|annum)|a\s+(?:year|month)|monthly|rupees?|\brs\b|₹|\binr\b/i;

function findIncomeCandidates(text) {
  const cands = [];
  const rx = new RegExp(MONEY_SRC, 'gi');
  let m;
  while ((m = rx.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const after = text.slice(end, end + 12);
    if (/^\s*(?:%|percent|acres?\b|-?\s*years?\s*-?\s*old)/i.test(after)) continue;
    let n = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    const unit = (m[3] || '').toLowerCase();
    const currency = Boolean(m[1]);
    if (unit.startsWith('la')) n *= 100000;
    else if (unit === 'thousand' || unit === 'k') n *= 1000;
    const around = text.slice(Math.max(0, m.index - 40), end + 40);
    const nearIncome = INCOME_CTX_RX.test(around);
    if (!(currency || unit || (nearIncome && n >= 1000))) continue;
    const tail = text.slice(end, end + 30);
    const monthly = /per\s+month|a\s+month|monthly|\/\s*month|every\s+month/i.test(tail);
    const value = Math.round(monthly ? n * 12 : n);
    cands.push({ value, index: m.index, text: m[0].trim(), nearIncome });
  }
  return cands;
}

const EDU_RULES = [
  ['illiterate', /\billiterate\b/i],
  ['postgraduate', /\bpost[\s-]?graduat\w*|\bmasters?\b|\bm\.\s?(?:a|sc|tech|com)\b|\bmba\b/i],
  ['graduate', /\bgraduat(?:e|ed|ion)?\b|\bbachelors?\b|\bb\.\s?(?:a|sc|com|tech|e)\b|\bbtech\b|\bbsc\b|\bbcom\b|\bbca\b|\bbba\b/i],
  ['diploma', /\bdiploma\b/i],
  ['ITI', /\bITI\b/],
  ['12th', /\b12th\b|\btwelfth\b|\bpuc\b|\bhsc\b|\bplus\s?two\b/i],
  ['10th', /\b10th\b|\btenth\b|\bsslc\b/i],
];

export function parseProfile(text) {
  const profile = {};
  const evidence = {};
  const hints = [];
  if (typeof text !== 'string') return { profile, evidence, unparsed_hints: hints };
  const slice = (m) => text.slice(m.index, m.index + m[0].length);
  const set = (field, value, m) => {
    profile[field] = value;
    evidence[field] = slice(m);
  };

  // age
  for (const rx of AGE_RX) {
    const m = rx.exec(text);
    if (m) {
      const n = Number(m[1]);
      if (n >= 0 && n <= 120) { set('age', n, m); break; }
    }
  }

  // income
  const cands = findIncomeCandidates(text);
  const chosen = cands.find((c) => c.nearIncome) ?? cands[0];
  if (chosen) {
    profile.annual_income = chosen.value;
    evidence.annual_income = chosen.text;
  }
  for (const c of cands) if (c !== chosen) hints.push(`amount "${c.text}" not used`);

  // state
  let best = null;
  for (const { state, rx } of STATE_RX) {
    const m = rx.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { state, m };
  }
  if (best) set('state', best.state, best.m);

  // gender (only when unambiguous)
  const fem = /\b(?:female|woman|women|girl|she|daughter)\b/i.exec(text);
  const male = /\b(?:male|man|men|boy|he|son)\b/i.exec(text);
  if (fem && !male) set('gender', 'female', fem);
  else if (male && !fem) set('gender', 'male', male);

  // caste category
  const CASTE_RX = [
    ['SC', /\bSC\b|scheduled\s+caste/],
    ['ST', /\bST\b|scheduled\s+tribe/],
    ['OBC', /\bOBC\b/i],
    ['EWS', /\bEWS\b/i],
    ['General', /\bgeneral\s+(?:category|caste|merit)\b/i],
  ];
  let caste = null;
  for (const [val, rx] of CASTE_RX) {
    const m = rx.exec(text);
    if (m && (!caste || m.index < caste.m.index)) caste = { val, m };
  }
  if (caste) set('caste_category', caste.val, caste.m);

  // education
  for (const [val, rx] of EDU_RULES) {
    const m = rx.exec(text);
    if (m) { set('education', val, m); break; }
  }

  // occupation
  const OCC_RX = [
    ['student', /\bstudent\b|\bstudying\b/i],
    ['farmer', /\bfarmer\b|\bfarming\b|\bfarm\b/i],
    ['daily wage labourer', /\bdaily\s+wage\b|\blabou?rer\b/i],
    ['self-employed', /\bself[\s-]?employed\b|\bmy own (?:shop|business)\b|\brun a (?:small )?shop\b/i],
    ['unemployed', /\bunemployed\b|\bno (?:regular )?job\b/i],
    ['homemaker', /\bhomemaker\b|\bhousewife\b/i],
  ];
  for (const [val, rx] of OCC_RX) {
    const m = rx.exec(text);
    if (m) { set('occupation', val, m); break; }
  }
  if (/\bstudent\b|\bstudying\b/i.test(text)) {
    const m = /\bstudent\b|\bstudying\b/i.exec(text);
    set('is_student', true, m);
  }
  const widow = /\bwidow(?:ed)?\b/i.exec(text);
  if (widow) set('is_widow', true, widow);

  // disability
  const dis = /\bdisab(?:led|ility)\b|\bdivyang\b|\bwheelchair\b|\bblind\b|\bdeaf\b/i.exec(text);
  if (dis) set('is_disabled', true, dis);

  // residence
  const rural = /\brural\b|\bvillage\b|\bgram\b/i.exec(text);
  const urban = /\burban\b|\bcity\b|\btown\b/i.exec(text);
  if (rural && !urban) set('residence', 'rural', rural);
  else if (urban && !rural) set('residence', 'urban', urban);

  // land
  const land = /(\d+(?:\.\d+)?)\s*acres?\b/i.exec(text);
  if (land) set('land_acres', Number(land[1]), land);

  // BPL card
  const bpl = /\bBPL\b|below\s+poverty/i.exec(text);
  if (bpl) set('has_bpl_card', true, bpl);

  // unparsed hints: family-size style numbers
  const fam = /\b\d+\s+(?:members?|people|children|kids|brothers|sisters)\b/gi;
  let fm;
  while ((fm = fam.exec(text)) !== null && hints.length < 10) hints.push(`"${fm[0]}" (family size) not used`);

  return { profile, evidence, unparsed_hints: hints };
}

// ---------- form <-> engine profile mapping ----------
// Form field id -> engine profile key. Education key in the engine is 'education'.
export const FORM_TO_PROFILE = { state: 'state', age: 'age', income: 'annual_income', level: 'education' };

export function toFormValues(profile) {
  const out = {};
  if (!profile || typeof profile !== 'object') return out;
  for (const [formKey, profileKey] of Object.entries(FORM_TO_PROFILE)) {
    const v = profile[profileKey];
    if (!isMissing(v)) out[formKey] = String(v);
  }
  return out;
}

export function toEngineProfile(form) {
  const out = {};
  if (!form || typeof form !== 'object') return out;
  for (const [formKey, profileKey] of Object.entries(FORM_TO_PROFILE)) {
    let v = form[formKey];
    if (typeof v === 'string') v = v.trim();
    if (isMissing(v)) continue;
    if (profileKey === 'age' || profileKey === 'annual_income') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[profileKey] = n;
    } else {
      out[profileKey] = v;
    }
  }
  return out;
}

// ---------- tracker ----------
export function createTracker() {
  return { version: 1, schemes: {} };
}
function schemesOf(tracker) {
  return tracker && typeof tracker === 'object' && tracker.schemes && typeof tracker.schemes === 'object'
    ? tracker.schemes
    : {};
}
export function setStatus(tracker, schemeId, status, nowIso) {
  if (typeof schemeId !== 'string' || !schemeId || !STATUSES.includes(status)) return tracker;
  const base = tracker && typeof tracker === 'object' ? tracker : createTracker();
  const map = schemesOf(base);
  const prev = Object.hasOwn(map, schemeId) ? map[schemeId] : null;
  // Preserve existing checklist progress when the status changes.
  const checklist = prev && typeof prev.checklist === 'object' && prev.checklist ? { ...prev.checklist } : {};
  return { ...base, version: 1, schemes: { ...map, [schemeId]: { status, updated_at: nowIso, checklist } } };
}
export function updateChecklist(tracker, schemeId, docIndex, done) {
  const base = tracker && typeof tracker === 'object' ? tracker : createTracker();
  const map = schemesOf(base);
  if (typeof schemeId !== 'string' || !Object.hasOwn(map, schemeId)) return tracker;
  if (!Number.isInteger(docIndex) || docIndex < 0 || typeof done !== 'boolean') return tracker;
  const entry = map[schemeId];
  if (!entry || typeof entry !== 'object') return tracker;
  const checklist = { ...(entry.checklist && typeof entry.checklist === 'object' ? entry.checklist : {}), [docIndex]: done };
  return { ...base, version: 1, schemes: { ...map, [schemeId]: { ...entry, checklist } } };
}
export function serialize(tracker) {
  try {
    return JSON.stringify(tracker ?? createTracker());
  } catch {
    return JSON.stringify(createTracker());
  }
}
export function deserialize(text) {
  try {
    if (typeof text !== 'string') return createTracker();
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return createTracker();
    if (!obj.schemes || typeof obj.schemes !== 'object' || Array.isArray(obj.schemes)) return createTracker();
    const out = {};
    for (const [id, entry] of Object.entries(obj.schemes)) {
      if (id === '__proto__' || !entry || typeof entry !== 'object' || !STATUSES.includes(entry.status)) continue;
      const checklist = {};
      if (entry.checklist && typeof entry.checklist === 'object' && !Array.isArray(entry.checklist)) {
        for (const [k, v] of Object.entries(entry.checklist)) {
          if (k !== '__proto__') checklist[k] = Boolean(v);
        }
      }
      out[id] = { status: entry.status, updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : null, checklist };
    }
    return { version: 1, schemes: out };
  } catch {
    return createTracker();
  }
}

// ---------- deadlines ----------
export function daysUntil(deadlineIso, nowIso) {
  if (typeof deadlineIso !== 'string' || typeof nowIso !== 'string' || !deadlineIso || !nowIso) return null;
  const d = Date.parse(deadlineIso);
  const n = Date.parse(nowIso);
  if (Number.isNaN(d) || Number.isNaN(n)) return null;
  return Math.floor((d - n) / DAY_MS);
}

export function deadlineReminders(tracker, catalog, nowIso, windowDays = 30) {
  const win = Number.isFinite(windowDays) ? windowDays : 30;
  const list = Array.isArray(catalog) ? catalog : [];
  const out = [];
  for (const [id, entry] of Object.entries(schemesOf(tracker))) {
    if (!entry || typeof entry !== 'object' || CLOSED.includes(entry.status)) continue;
    const scheme = list.find((s) => s && s.id === id);
    if (!scheme) continue;
    const name_en = scheme.name_en ?? id;
    const name_kn = scheme.name_kn ?? name_en;
    const base = { scheme_id: id, scheme_name_en: name_en, scheme_name_kn: name_kn };
    if (scheme.deadline === null || scheme.deadline === undefined) {
      out.push({
        ...base,
        kind: 'no_deadline_published',
        days_left: null,
        message_en: `No deadline is published for ${name_en} in this demo data. Check the official source before relying on any date.`,
        message_kn: `${name_kn}ಗೆ ಯಾವುದೇ ಗಡುವು ಪ್ರಕಟವಾಗಿಲ್ಲ. ಯಾವುದೇ ದಿನಾಂಕವನ್ನು ನಂಬುವ ಮೊದಲು ಅಧಿಕೃತ ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.`,
      });
      continue;
    }
    const days = daysUntil(scheme.deadline, nowIso);
    if (days === null) continue; // cannot evaluate with the given dates; never invent one
    if (days < 0) {
      out.push({
        ...base,
        kind: 'deadline_passed',
        days_left: days,
        message_en: `The deadline for ${name_en} passed ${-days} day(s) ago. Check the official source for any new round.`,
        message_kn: `${name_kn}ರ ಗಡುವು ${-days} ದಿನಗಳ ಹಿಂದೆ ಮುಗಿದಿದೆ.`,
      });
    } else if (days <= win) {
      out.push({
        ...base,
        kind: 'deadline_in_window',
        days_left: days,
        message_en: `${name_en} closes in ${days} day(s).`,
        message_kn: `${name_kn}ರ ಗಡುವು ${days} ದಿನಗಳಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ.`,
      });
    }
  }
  return out;
}

// ---------- offline Q&A ----------
// Scores each scheme: full name match is worth most, each matching tag adds one. Highest score wins; ties keep catalog order.
function findSchemeInText(lower, catalog) {
  let best = null;
  let bestScore = 0;
  for (const s of catalog) {
    if (!s || typeof s !== 'object') continue;
    let score = 0;
    const name = String(s.name_en ?? '').toLowerCase();
    if (name && lower.includes(name)) score += 100;
    const tags = Array.isArray(s.tags) ? s.tags : [];
    for (const tag of tags) {
      const tg = String(tag).toLowerCase().trim();
      if (tg && new RegExp(`\\b${escapeRe(tg)}s?\\b`).test(lower)) score += 1;
    }
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return best;
}

const INTENT_RX = [
  ['about', /haqsetu|\babout\b|what is this|ಬಗ್ಗೆ/i],
  ['eligibility', /eligib|qualif|ಅರ್ಹ/i],
  ['documents', /document|paper|certificate|ದಾಖಲೆ/i],
  ['deadline', /deadline|last date|due date|ಗಡುವು|ಕೊನೆಯ ದಿನಾಂಕ/i],
  ['apply', /\bapply\b|application|ಅರ್ಜಿ/i],
  ['help', /\bhi\b|\bhello\b|\bhey\b|\bhelp\b|namaste|ನಮಸ್ತೆ|ನಮಸ್ಕಾರ|ಸಹಾಯ/i],
];

export function answerQuestion(text, options = {}) {
  try {
    const opts = options && typeof options === 'object' ? options : {};
    const catalog = Array.isArray(opts.catalog) ? opts.catalog : [];
    const raw = typeof text === 'string' ? text : '';
    const lower = raw.toLowerCase();
    const found = findSchemeInText(lower, catalog);
    const intent = (INTENT_RX.find(([, rx]) => rx.test(raw)) ?? [null])[0];
    const hasProfile = opts.profile && typeof opts.profile === 'object' && Object.keys(opts.profile).length > 0;

    // Kannada replies: machine-drafted, needs native review.
    const reply = (en, kn, suggestions = []) => ({ intent: intent ?? 'unknown', reply_en: en, reply_kn: kn, suggestions });

    if (intent === 'about') {
      return reply(
        'HaqSetu AI helps you find government schemes you may qualify for, check each rule in plain language, and track your applications. This demo uses fictional sample schemes, so check official sources before acting.',
        'ಹಕ್ಕುಸೇತು AI ನಿಮಗೆ ಅರ್ಹವಾಗಬಹುದಾದ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ಈ ಡೆಮೊ ಕಾಲ್ಪನಿಕ ಯೋಜನೆಗಳನ್ನು ಬಳಸುತ್ತದೆ; ಕ್ರಮ ಕೈಗೊಳ್ಳುವ ಮೊದಲು ಅಧಿಕೃತ ಮೂಲಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
        HELP_SUGGESTIONS,
      );
    }
    if (intent === 'eligibility') {
      if (!hasProfile) {
        return reply(
          'Tell me about yourself: your age, annual family income, state, education, occupation and whether you hold a BPL card. For example: "I am 23, a student in Karnataka, family income 1.5 lakh a year."',
          'ದಯವಿಟ್ಟು ನಿಮ್ಮ ವಯಸ್ಸು, ವಾರ್ಷಿಕ ಕುಟುಂಬ ಆದಾಯ, ರಾಜ್ಯ, ಶಿಕ್ಷಣ ಮತ್ತು ಉದ್ಯೋಗದ ಬಗ್ಗೆ ಹೇಳಿ.',
          ['I am 23, a student in Karnataka, family income 1.5 lakh a year'],
        );
      }
      const results = matchAll(opts.profile, catalog);
      const eligible = results.filter((r) => r.status === 'eligible');
      const pending = results.filter((r) => r.status === 'more_info_needed');
      if (eligible.length) {
        return reply(
          `Based on your profile, you may be eligible for: ${eligible.map((r) => r.scheme_name_en).join('; ')}. Check each rule before applying.`,
          `ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಆಧಾರದ ಮೇಲೆ ನೀವು ಅರ್ಹರಾಗಿರಬಹುದಾದ ಯೋಜನೆಗಳು: ${eligible.map((r) => r.scheme_name_kn).join('; ')}. ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಪ್ರತಿ ನಿಯಮವನ್ನು ಪರಿಶೀಲಿಸಿ.`,
        );
      }
      if (pending.length) {
        return reply(
          `No scheme is clearly eligible yet. Add the missing details (for example age, income or state) so I can check: ${pending.map((r) => r.scheme_name_en).join('; ')}.`,
          'ಇನ್ನೂ ಯಾವ ಯೋಜನೆಯೂ ಸ್ಪಷ್ಟವಾಗಿ ಅರ್ಹವಲ್ಲ. ಕಾಣೆಯಾದ ಮಾಹಿತಿಯನ್ನು ಸೇರಿಸಿ.',
        );
      }
      return reply(
        'Based on this profile, none of the sample schemes match. Try describing your situation again.',
        'ಈ ಪ್ರೊಫೈಲ್ ಆಧಾರದ ಮೇಲೆ ಯಾವುದೇ ಮಾದರಿ ಯೋಜನೆ ಹೊಂದುವುದಿಲ್ಲ. ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ಮತ್ತೆ ವಿವರಿಸಿ.',
      );
    }
    if (intent === 'documents') {
      if (found) {
        const docs = Array.isArray(found.documents) ? found.documents : [];
        return reply(
          `Documents for ${found.name_en}: ${docs.map((d) => d.en).join('; ')}.`,
          `${found.name_kn}ಗೆ ಬೇಕಾದ ದಾಖಲೆಗಳು: ${docs.map((d) => d.kn).join('; ')}.`,
          HELP_SUGGESTIONS,
        );
      }
      return reply(
        'Common documents often include proof of identity, an income certificate and proof of residence. Tell me the scheme name to see its exact list.',
        'ಸಾಮಾನ್ಯವಾಗಿ ಗುರುತಿನ ಪುರಾವೆ, ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ ಮತ್ತು ವಾಸಸ್ಥಳದ ಪುರಾವೆ ಬೇಕಾಗುತ್ತವೆ. ಯೋಜನೆಯ ಹೆಸರು ಹೇಳಿ.',
        catalog.slice(0, 3).map((s) => s.name_en),
      );
    }
    if (intent === 'deadline') {
      if (found) {
        if (found.deadline === null || found.deadline === undefined) {
          return reply(
            `No deadline is published for ${found.name_en} in this demo data. Check the official source; no date is assumed.`,
            `${found.name_kn}ಗೆ ಈ ಡೆಮೊ ಮಾಹಿತಿಯಲ್ಲಿ ಗಡುವು ಪ್ರಕಟವಾಗಿಲ್ಲ. ಅಧಿಕೃತ ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.`,
          );
        }
        return reply(`The deadline for ${found.name_en} is ${found.deadline}.`, `${found.name_kn}ರ ಗಡುವು: ${found.deadline}.`);
      }
      const withDeadline = catalog.filter((s) => s && s.deadline);
      if (withDeadline.length) {
        const list = withDeadline.map((s) => `${s.name_en} (${s.deadline})`).join('; ');
        return reply(`Known deadlines: ${list}.`, `ತಿಳಿದಿರುವ ಗಡುವುಗಳು: ${list}.`);
      }
      return reply(
        'The demo data publishes no deadlines. Check the official source of any scheme for last dates; none are assumed here.',
        'ಈ ಡೆಮೊ ಮಾಹಿತಿಯಲ್ಲಿ ಯಾವುದೇ ಗಡುವು ಪ್ರಕಟವಾಗಿಲ್ಲ. ಅಧಿಕೃತ ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.',
      );
    }
    if (intent === 'apply') {
      if (found) {
        const steps = Array.isArray(found.apply_steps_en) ? found.apply_steps_en : [];
        return reply(
          `To apply for ${found.name_en}: ${steps.map((s, i) => `${i + 1}. ${s}.`).join(' ')}`,
          `${found.name_kn}ಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಅಧಿಕೃತ ಪೋರ್ಟಲ್ ಅಥವಾ ಕಚೇರಿಯನ್ನು ಬಳಸಿ ಮತ್ತು ದಾಖಲೆಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.`,
        );
      }
      return reply(
        'Pick a scheme first (for example "Demo Widow Pension"), then ask how to apply. In general: check eligibility, gather documents, fill the form on the official portal and save the acknowledgement.',
        'ಮೊದಲು ಯೋಜನೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ, ನಂತರ ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಬಗ್ಗೆ ಕೇಳಿ. ಸಾಮಾನ್ಯವಾಗಿ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ, ದಾಖಲೆ ಸಿದ್ಧಪಡಿಸಿ, ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಅರ್ಜಿ ತುಂಬಿ.',
        catalog.slice(0, 3).map((s) => s.name_en),
      );
    }
    if (intent === 'help') {
      return reply(
        'Hello! I can help you check eligibility, list documents, explain how to apply and show deadlines. Try one of the suggestions below.',
        'ನಮಸ್ಕಾರ! ಅರ್ಹತೆ ಪರಿಶೀಲನೆ, ದಾಖಲೆಗಳ ಪಟ್ಟಿ, ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ವಿಧಾನ ಮತ್ತು ಗಡುವುಗಳ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.',
        HELP_SUGGESTIONS,
      );
    }
    return reply(
      'Sorry, I did not understand that. Try one of the suggestions below.',
      'ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ಕೆಳಗಿನ ಸಲಹೆಗಳಲ್ಲಿ ಒಂದನ್ನು ಪ್ರಯತ್ನಿಸಿ.',
      HELP_SUGGESTIONS,
    );
  } catch {
    return {
      intent: 'unknown',
      reply_en: 'Sorry, something went wrong. Try one of the suggestions below.',
      reply_kn: 'ಕ್ಷಮಿಸಿ, ಏನೋ ತಪ್ಪಾಗಿದೆ. ಕೆಳಗಿನ ಸಲಹೆಗಳಲ್ಲಿ ಒಂದನ್ನು ಪ್ರಯತ್ನಿಸಿ.',
      suggestions: HELP_SUGGESTIONS,
    };
  }
}

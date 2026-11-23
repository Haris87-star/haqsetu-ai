// node:test suite for engine.js. Expectations were checked by reading engine.js (no shell, not executed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, loadPersonas, demoPersonas } from './loader.js';
import {
  matchScheme,
  parseProfile,
  evaluateScheme,
  matchAll,
  searchSchemes,
  buildChecklist,
  createTracker,
  setStatus,
  updateChecklist,
  serialize,
  deserialize,
  daysUntil,
  deadlineReminders,
  answerQuestion,
  toFormValues,
  toEngineProfile,
} from './engine.js';

const NOW = '2026-03-11T00:00:00.000Z';
const DAY = 86400000;

const statusMap = (profile) =>
  Object.fromEntries(matchAll(profile, loadCatalog()).map((r) => [r.scheme_id, r.status]));

const persona = (id) => loadPersonas().find((p) => p.id === id).profile;

// ---------- parseProfile ----------
test('parseProfile: "I am 23" sets age 23', () => {
  assert.equal(parseProfile('I am 23 and live in Karnataka').profile.age, 23);
});

test('parseProfile: "23 years old" sets age 23', () => {
  assert.equal(parseProfile('I am a 23 years old student').profile.age, 23);
});

test('parseProfile: "percentage" does not set age', () => {
  assert.equal(parseProfile('My percentage is 85').profile.age, undefined);
  assert.equal(parseProfile('I scored 85 percentage in my exam').profile.age, undefined);
});

test('parseProfile: age still parsed when a percentage is also mentioned', () => {
  assert.equal(parseProfile('I am 23 and got 85 percentage').profile.age, 23);
});

test('parseProfile: "2 lakh" becomes 200000', () => {
  assert.equal(parseProfile('My annual family income is 2 lakh.').profile.annual_income, 200000);
});

test('parseProfile: "1.5 lakh a year" becomes 150000', () => {
  assert.equal(parseProfile('family income 1.5 lakh a year').profile.annual_income, 150000);
});

test('parseProfile: "15000 per month" becomes 180000 a year', () => {
  assert.equal(parseProfile('I earn 15000 per month.').profile.annual_income, 180000);
});

test('parseProfile: missing fields are absent, not zero', () => {
  const { profile } = parseProfile('I am a student in Karnataka');
  assert.equal('annual_income' in profile, false);
  assert.equal('age' in profile, false);
  assert.equal(profile.state, 'Karnataka');
});

test('parseProfile: non-string input gives an empty profile', () => {
  assert.deepStrictEqual(parseProfile(null).profile, {});
});

// ---------- evaluateScheme: rule ops with inline schemes ----------
const one = (rule) => ({ id: 's', name_en: 'S', name_kn: 'ಎಸ್', rules: [{ id: 'r', label_en: 'L', label_kn: 'ಎ', required: true, ...rule }] });

test('op eq: match is case-insensitive and eligible', () => {
  const r = evaluateScheme(one({ field: 'occupation', op: 'eq', value: 'farmer' }), { occupation: 'Farmer' });
  assert.equal(r.status, 'eligible');
  assert.equal(r.checks[0].result, 'pass');
});

test('op eq: mismatch is not_eligible', () => {
  assert.equal(evaluateScheme(one({ field: 'occupation', op: 'eq', value: 'farmer' }), { occupation: 'student' }).status, 'not_eligible');
});

test('op in: listed value is eligible', () => {
  const s = one({ field: 'education', op: 'in', value: ['10th', '12th'] });
  assert.equal(evaluateScheme(s, { education: '12th' }).status, 'eligible');
});

test('op in: unlisted value is not_eligible', () => {
  const s = one({ field: 'education', op: 'in', value: ['10th', '12th'] });
  assert.equal(evaluateScheme(s, { education: 'graduate' }).status, 'not_eligible');
});

test('op lte: limit is inclusive; above limit is not_eligible', () => {
  const s = one({ field: 'annual_income', op: 'lte', value: 250000 });
  assert.equal(evaluateScheme(s, { annual_income: 250000 }).status, 'eligible');
  assert.equal(evaluateScheme(s, { annual_income: 250001 }).status, 'not_eligible');
});

test('op gte: minimum is inclusive; below minimum is not_eligible', () => {
  const s = one({ field: 'age', op: 'gte', value: 18 });
  assert.equal(evaluateScheme(s, { age: 18 }).status, 'eligible');
  assert.equal(evaluateScheme(s, { age: 17 }).status, 'not_eligible');
});

test('op between: both bounds inclusive; outside is not_eligible', () => {
  const s = one({ field: 'age', op: 'between', value: [18, 35] });
  assert.equal(evaluateScheme(s, { age: 18 }).status, 'eligible');
  assert.equal(evaluateScheme(s, { age: 35 }).status, 'eligible');
  assert.equal(evaluateScheme(s, { age: 36 }).status, 'not_eligible');
});

test('op truthy: true and "yes" pass', () => {
  const s = one({ field: 'is_widow', op: 'truthy' });
  assert.equal(evaluateScheme(s, { is_widow: true }).status, 'eligible');
  assert.equal(evaluateScheme(s, { is_widow: 'yes' }).status, 'eligible');
});

test('op truthy: false fails a required rule', () => {
  assert.equal(evaluateScheme(one({ field: 'is_widow', op: 'truthy' }), { is_widow: false }).status, 'not_eligible');
});

test('op includes: array value containing the item passes', () => {
  const s = one({ field: 'occupation', op: 'includes', value: 'farmer' });
  assert.equal(evaluateScheme(s, { occupation: ['student', 'farmer'] }).status, 'eligible');
});

test('op includes: substring of a string value passes', () => {
  const s = one({ field: 'occupation', op: 'includes', value: 'shop' });
  assert.equal(evaluateScheme(s, { occupation: 'runs a small shop' }).status, 'eligible');
  assert.equal(evaluateScheme(s, { occupation: 'homemaker' }).status, 'not_eligible');
});

test('op state_in: listed state (any case) is eligible; other state is not_eligible', () => {
  const s = one({ field: 'state', op: 'state_in', value: ['Karnataka', 'Kerala'] });
  assert.equal(evaluateScheme(s, { state: 'karnataka' }).status, 'eligible');
  assert.equal(evaluateScheme(s, { state: 'Goa' }).status, 'not_eligible');
});

test('unknown op fails the rule and is reported as not supported', () => {
  const r = evaluateScheme(one({ field: 'age', op: 'regex', value: '.*' }), { age: 20 });
  assert.equal(r.status, 'not_eligible');
  assert.match(r.checks[0].detail_en, /not supported/);
});

test('required fail takes precedence over required missing', () => {
  const scheme = {
    id: 's',
    rules: [
      { id: 'a', field: 'age', op: 'gte', value: 18, required: true },
      { id: 'b', field: 'state', op: 'eq', value: 'Karnataka', required: true },
    ],
  };
  assert.equal(evaluateScheme(scheme, { age: 10 }).status, 'not_eligible');
});

test('required missing with no required fail gives more_info_needed', () => {
  const r = evaluateScheme(one({ field: 'age', op: 'gte', value: 18 }), {});
  assert.equal(r.status, 'more_info_needed');
  assert.equal(r.checks[0].result, 'missing');
  assert.match(r.checks[0].detail_en, /We need your age/);
});

test('failed optional rule does not block eligibility; score reflects it', () => {
  const scheme = {
    id: 's',
    rules: [
      { id: 'a', field: 'age', op: 'gte', value: 18, required: true },
      { id: 'b', field: 'annual_income', op: 'lte', value: 1, required: false },
    ],
  };
  const r = evaluateScheme(scheme, { age: 20, annual_income: 5000 });
  assert.equal(r.status, 'eligible');
  assert.equal(r.score, 0.5);
});

test('matchScheme returns the same result as evaluateScheme', () => {
  const scheme = loadCatalog()[2];
  assert.deepStrictEqual(matchScheme(persona('persona-urban-widow'), scheme), evaluateScheme(scheme, persona('persona-urban-widow')));
});

test('evaluateScheme with a null profile does not throw and reports missing data', () => {
  const r = evaluateScheme(loadCatalog()[2], null);
  assert.equal(r.status, 'more_info_needed');
});

// ---------- catalog and personas ----------
test('loadCatalog returns the 8 demo schemes', () => {
  const ids = loadCatalog().map((s) => s.id).sort();
  assert.deepStrictEqual(ids, [
    'demo-disability-pension', 'demo-farmer-support', 'demo-health-cover', 'demo-rural-housing',
    'demo-student-scholarship', 'demo-widow-pension', 'demo-women-skilling', 'demo-youth-employment',
  ]);
});

test('loadPersonas returns the 3 judge personas, also exported as demoPersonas', () => {
  const ids = loadPersonas().map((p) => p.id);
  assert.deepStrictEqual(ids, ['persona-rural-student', 'persona-urban-widow', 'persona-disabled-youth']);
  assert.equal(demoPersonas.length, 3);
});

test('persona-rural-student statuses match the rules', () => {
  assert.deepStrictEqual(statusMap(persona('persona-rural-student')), {
    'demo-student-scholarship': 'eligible',
    'demo-farmer-support': 'not_eligible',
    'demo-widow-pension': 'not_eligible',
    'demo-disability-pension': 'more_info_needed',
    'demo-rural-housing': 'eligible',
    'demo-health-cover': 'eligible',
    'demo-women-skilling': 'eligible',
    'demo-youth-employment': 'eligible',
  });
});

test('persona-urban-widow statuses match the rules', () => {
  assert.deepStrictEqual(statusMap(persona('persona-urban-widow')), {
    'demo-student-scholarship': 'not_eligible',
    'demo-farmer-support': 'not_eligible',
    'demo-widow-pension': 'eligible',
    'demo-disability-pension': 'more_info_needed',
    'demo-rural-housing': 'not_eligible',
    'demo-health-cover': 'eligible',
    'demo-women-skilling': 'not_eligible',
    'demo-youth-employment': 'not_eligible',
  });
});

test('persona-disabled-youth statuses match the rules', () => {
  assert.deepStrictEqual(statusMap(persona('persona-disabled-youth')), {
    'demo-student-scholarship': 'not_eligible',
    'demo-farmer-support': 'not_eligible',
    'demo-widow-pension': 'not_eligible',
    'demo-disability-pension': 'not_eligible',
    'demo-rural-housing': 'not_eligible',
    'demo-health-cover': 'not_eligible',
    'demo-women-skilling': 'not_eligible',
    'demo-youth-employment': 'eligible',
  });
});

test('each persona has at least one eligible or more_info_needed scheme', () => {
  for (const p of loadPersonas()) {
    const statuses = matchAll(p.profile, loadCatalog()).map((r) => r.status);
    assert.ok(statuses.some((s) => s === 'eligible' || s === 'more_info_needed'), p.id);
  }
});

test('across the 3 personas there is an eligible, a more_info_needed and a not_eligible result', () => {
  const all = loadPersonas().flatMap((p) => matchAll(p.profile, loadCatalog()).map((r) => r.status));
  assert.ok(all.includes('eligible'));
  assert.ok(all.includes('more_info_needed'));
  assert.ok(all.includes('not_eligible'));
});

test('matchAll puts eligible results before more_info_needed and not_eligible', () => {
  const results = matchAll(persona('persona-rural-student'), loadCatalog());
  assert.equal(results[0].status, 'eligible');
  const rank = { eligible: 0, more_info_needed: 1, not_eligible: 2 };
  for (let i = 1; i < results.length; i++) {
    assert.ok(rank[results[i - 1].status] <= rank[results[i].status]);
  }
});

test('matchAll with a non-array catalog returns an empty list', () => {
  assert.deepStrictEqual(matchAll({}, null), []);
});

// ---------- search ----------
test('searchSchemes: English query "widow" finds the widow pension', () => {
  const ids = searchSchemes(loadCatalog(), { query: 'widow' }).map((s) => s.id);
  assert.ok(ids.includes('demo-widow-pension'));
  assert.ok(!ids.includes('demo-health-cover'));
});

test('searchSchemes: Kannada query finds the scheme by its Kannada name', () => {
  const ids = searchSchemes(loadCatalog(), { query: 'ವಿಧವಾ' }).map((s) => s.id);
  assert.ok(ids.includes('demo-widow-pension'));
});

test('searchSchemes: Kannada pension word matches both pension schemes', () => {
  const ids = searchSchemes(loadCatalog(), { query: 'ಪಿಂಚಣಿ' }).map((s) => s.id);
  assert.ok(ids.includes('demo-widow-pension'));
  assert.ok(ids.includes('demo-disability-pension'));
});

test('searchSchemes: category filter returns exactly the two Employment schemes', () => {
  const ids = searchSchemes(loadCatalog(), { category: 'Employment' }).map((s) => s.id).sort();
  assert.deepStrictEqual(ids, ['demo-women-skilling', 'demo-youth-employment']);
});

test('searchSchemes: no options returns the whole catalog; non-array gives []', () => {
  assert.equal(searchSchemes(loadCatalog()).length, 8);
  assert.deepStrictEqual(searchSchemes(null), []);
});

// ---------- checklist ----------
test('buildChecklist: BPL card marks the BPL/ration document possibly_have', () => {
  const health = loadCatalog().find((s) => s.id === 'demo-health-cover');
  const list = buildChecklist(health, { has_bpl_card: true });
  assert.equal(list[1].doc_en, 'Ration or BPL card (demo)');
  assert.equal(list[1].status, 'possibly_have');
  assert.equal(list[0].status, 'needed');
});

test('buildChecklist: without BPL card every document stays needed; Kannada language uses doc_kn', () => {
  const health = loadCatalog().find((s) => s.id === 'demo-health-cover');
  assert.ok(buildChecklist(health, {}).every((d) => d.status === 'needed'));
  assert.equal(buildChecklist(health, {}, 'kn')[0].doc, 'ಗುರುತಿನ ಪುರಾವೆ (ಡೆಮೊ)');
});

test('buildChecklist: widow flag marks the spouse death certificate possibly_have', () => {
  const widow = loadCatalog().find((s) => s.id === 'demo-widow-pension');
  const list = buildChecklist(widow, { is_widow: true });
  assert.equal(list[1].status, 'possibly_have');
});

// ---------- tracker ----------
test('createTracker returns an empty version-1 tracker', () => {
  assert.deepStrictEqual(createTracker(), { version: 1, schemes: {} });
});

test('setStatus: valid status is stored and does not mutate the input', () => {
  const t = createTracker();
  const next = setStatus(t, 'demo-widow-pension', 'interested', NOW);
  assert.equal(next.schemes['demo-widow-pension'].status, 'interested');
  assert.equal(next.schemes['demo-widow-pension'].updated_at, NOW);
  assert.deepStrictEqual(t.schemes, {});
});

test('setStatus: invalid status returns the same tracker object', () => {
  const t = createTracker();
  assert.equal(setStatus(t, 'demo-widow-pension', 'bogus', NOW), t);
});

test('setStatus: empty scheme id returns the same tracker object', () => {
  const t = createTracker();
  assert.equal(setStatus(t, '', 'interested', NOW), t);
});

test('setStatus keeps checklist progress when the status changes', () => {
  let t = setStatus(createTracker(), 'demo-widow-pension', 'interested', NOW);
  t = updateChecklist(t, 'demo-widow-pension', 0, true);
  t = setStatus(t, 'demo-widow-pension', 'checklist_in_progress', NOW);
  assert.equal(t.schemes['demo-widow-pension'].status, 'checklist_in_progress');
  assert.deepStrictEqual(t.schemes['demo-widow-pension'].checklist, { 0: true });
});

test('updateChecklist: sets a document flag for a tracked scheme', () => {
  const t = updateChecklist(setStatus(createTracker(), 'demo-widow-pension', 'interested', NOW), 'demo-widow-pension', 2, true);
  assert.equal(t.schemes['demo-widow-pension'].checklist[2], true);
});

test('updateChecklist: unknown scheme or bad index returns the same tracker', () => {
  const t = setStatus(createTracker(), 'demo-widow-pension', 'interested', NOW);
  assert.equal(updateChecklist(t, 'demo-unknown', 0, true), t);
  assert.equal(updateChecklist(t, 'demo-widow-pension', -1, true), t);
  assert.equal(updateChecklist(t, 'demo-widow-pension', 0, 'yes'), t);
});

test('serialize then deserialize round-trips a tracker', () => {
  let t = setStatus(createTracker(), 'demo-youth-employment', 'submitted', NOW);
  t = updateChecklist(t, 'demo-youth-employment', 0, true);
  assert.deepStrictEqual(deserialize(serialize(t)), t);
});

test('serialize returns valid JSON text', () => {
  assert.deepStrictEqual(JSON.parse(serialize(createTracker())), createTracker());
});

// ---------- deserialize: never throws, always a valid tracker ----------
test('deserialize: invalid JSON returns an empty tracker', () => {
  assert.deepStrictEqual(deserialize('{not json'), createTracker());
});

test('deserialize: wrong shapes (array, null, non-string, array schemes) return an empty tracker', () => {
  assert.deepStrictEqual(deserialize('[1,2]'), createTracker());
  assert.deepStrictEqual(deserialize('null'), createTracker());
  assert.deepStrictEqual(deserialize(42), createTracker());
  assert.deepStrictEqual(deserialize('{"schemes":[]}'), createTracker());
});

test('deserialize: unknown status entries are dropped', () => {
  const t = deserialize('{"version":1,"schemes":{"demo-widow-pension":{"status":"hacked"}}}');
  assert.equal(t.version, 1);
  assert.deepStrictEqual(t.schemes, {});
});

test('deserialize: valid entry is kept with an empty checklist when none is stored', () => {
  const t = deserialize('{"schemes":{"demo-widow-pension":{"status":"approved"}}}');
  assert.equal(t.schemes['demo-widow-pension'].status, 'approved');
  assert.deepStrictEqual(t.schemes['demo-widow-pension'].checklist, {});
});

// ---------- daysUntil ----------
test('daysUntil: null, missing or invalid input gives null', () => {
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil('2026-04-01T00:00:00Z', null), null);
  assert.equal(daysUntil('not-a-date', NOW), null);
});

test('daysUntil: past deadline is negative', () => {
  assert.equal(daysUntil('2026-03-01T00:00:00Z', NOW), -10);
});

test('daysUntil: future deadline is positive', () => {
  assert.equal(daysUntil('2026-03-21T00:00:00Z', NOW), 10);
});

// ---------- deadlineReminders ----------
test('deadlineReminders: scheme with null deadline gives no_deadline_published and no invented date', () => {
  const t = setStatus(createTracker(), 'demo-student-scholarship', 'interested', NOW);
  const out = deadlineReminders(t, loadCatalog(), NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'no_deadline_published');
  assert.equal(out[0].days_left, null);
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(out[0].message_en), false);
});

test('deadlineReminders: in-memory scheme 10 days ahead gives deadline_in_window', () => {
  const catalog = [{ id: 'x', name_en: 'Test Scheme', name_kn: 'ಟೆಸ್ಟ್', deadline: new Date(Date.parse(NOW) + 10 * DAY).toISOString() }];
  const t = setStatus(createTracker(), 'x', 'interested', NOW);
  const out = deadlineReminders(t, catalog, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'deadline_in_window');
  assert.equal(out[0].days_left, 10);
});

test('deadlineReminders: past in-memory deadline gives deadline_passed', () => {
  const catalog = [{ id: 'x', name_en: 'Test Scheme', name_kn: 'ಟೆಸ್ಟ್', deadline: '2026-03-01T00:00:00Z' }];
  const out = deadlineReminders(setStatus(createTracker(), 'x', 'interested', NOW), catalog, NOW);
  assert.equal(out[0].kind, 'deadline_passed');
  assert.equal(out[0].days_left, -10);
});

test('deadlineReminders: closed (withdrawn) schemes produce no reminder', () => {
  const catalog = [{ id: 'x', name_en: 'Test Scheme', name_kn: 'ಟೆಸ್ಟ್', deadline: '2026-03-21T00:00:00Z' }];
  const out = deadlineReminders(setStatus(createTracker(), 'x', 'withdrawn', NOW), catalog, NOW);
  assert.deepStrictEqual(out, []);
});

// ---------- answerQuestion (offline Q&A) ----------
test('answerQuestion: greeting gives help intent with suggestions and Kannada reply', () => {
  const r = answerQuestion('hello');
  assert.equal(r.intent, 'help');
  assert.ok(r.reply_en.length > 0);
  assert.ok(typeof r.reply_kn === 'string' && r.reply_kn.length > 0);
  assert.equal(r.suggestions.length, 4);
});

test('answerQuestion: eligibility without a profile asks for details', () => {
  const r = answerQuestion('Am I eligible?');
  assert.equal(r.intent, 'eligibility');
  assert.match(r.reply_en, /Tell me/);
  assert.ok(r.reply_kn.length > 0);
});

test('answerQuestion: eligibility with a profile names eligible schemes', () => {
  const r = answerQuestion('Am I eligible?', { profile: persona('persona-rural-student'), catalog: loadCatalog() });
  assert.equal(r.intent, 'eligibility');
  assert.match(r.reply_en, /may be eligible for/);
  assert.ok(r.reply_kn.length > 0);
});

test('answerQuestion: documents for a named scheme lists its documents', () => {
  const r = answerQuestion('What documents do I need for Demo Widow Pension?', { catalog: loadCatalog() });
  assert.equal(r.intent, 'documents');
  assert.match(r.reply_en, /Documents for Demo Widow Pension/);
  assert.match(r.reply_en, /Death certificate of spouse \(demo\)/);
  assert.ok(r.reply_kn.length > 0);
});

test('answerQuestion: deadline for a scheme with no published date says so', () => {
  const r = answerQuestion('What is the deadline for Demo Widow Pension?', { catalog: loadCatalog() });
  assert.equal(r.intent, 'deadline');
  assert.match(r.reply_en, /No deadline is published for Demo Widow Pension/);
  assert.ok(r.reply_kn.length > 0);
});

test('answerQuestion: apply for a named scheme gives numbered steps', () => {
  const r = answerQuestion('How do I apply for Demo Widow Pension?', { catalog: loadCatalog() });
  assert.equal(r.intent, 'apply');
  assert.match(r.reply_en, /To apply for Demo Widow Pension/);
  assert.ok(r.reply_kn.length > 0);
});

test('answerQuestion: unrelated text gives unknown intent with suggestions', () => {
  const r = answerQuestion('xyzzy plugh');
  assert.equal(r.intent, 'unknown');
  assert.equal(r.suggestions.length, 4);
});

// ---------- story extraction and form/engine round-trip ----------
test('age extraction: "I\'m a 20-year-old" gives age 20', () => {
  assert.equal(parseProfile("I'm a 20-year-old engineering student from Karnataka.").profile.age, 20);
});

test('income extraction: "₹1,50,000" gives annual_income 150000', () => {
  assert.equal(parseProfile("My family's annual income is ₹1,50,000.").profile.annual_income, 150000);
});

test('education extraction: "bachelor\'s degree" maps to graduate', () => {
  assert.equal(parseProfile("I'm studying for my bachelor's degree.").profile.education, 'graduate');
});

test('complete flow: story -> form values -> engine profile -> eligibility', () => {
  const story = "I'm a 20-year-old engineering student from Karnataka. My family's annual income is ₹1,50,000. I'm studying for my bachelor's degree.";
  const r = parseProfile(story);
  const form = toFormValues(r.profile);
  assert.equal(form.age, '20');
  assert.equal(form.income, '150000');
  assert.equal(form.state, 'Karnataka');
  const eng = toEngineProfile(form);
  assert.equal(eng.age, 20);
  assert.equal(eng.annual_income, 150000);
  const results = matchAll(eng, loadCatalog());
  assert.equal(results.length, loadCatalog().length);
  for (const x of results) {
    assert.ok(['eligible', 'not_eligible', 'more_info_needed'].includes(x.status));
    assert.ok(Array.isArray(x.checks));
  }
  assert.ok(results.every((x) => x.scheme_name_en && x.scheme_name_en.length > 0));
});

test('form values round-trip: toEngineProfile(toFormValues(p)) keeps age, annual_income, state for a persona', () => {
  for (const p of loadPersonas()) {
    const eng = toEngineProfile(toFormValues(p.profile));
    if (p.profile.age !== undefined) assert.equal(eng.age, Number(p.profile.age));
    if (p.profile.annual_income !== undefined) assert.equal(eng.annual_income, Number(p.profile.annual_income));
    if (p.profile.state) assert.equal(eng.state, p.profile.state);
  }
});

test('persona rendering contract: every persona has a string name and a profile object', () => {
  for (const p of loadPersonas()) {
    assert.ok(typeof p.name === 'string' && p.name.length > 0, p.id);
    assert.ok(typeof p.profile === 'object' && p.profile !== null, p.id);
    assert.equal(typeof p.description, 'string', p.id);
  }
});

test('missing scheme reference does not throw: evaluateScheme(null, {}) returns status more_info_needed and checks []', () => {
  const r = evaluateScheme(null, {});
  assert.equal(r.status, 'more_info_needed');
  assert.ok(Array.isArray(r.checks) && r.checks.length === 0);
});

test('empty form gives empty engine profile', () => {
  assert.deepEqual(toEngineProfile({ state: '', age: '', income: '', level: '' }), {});
});


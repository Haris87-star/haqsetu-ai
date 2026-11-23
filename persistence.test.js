import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrackerStatus, documentProgress, sanitizeSession, parseSession, profileSignature, isResultOutdated } from './persistence.js';

test('normalizeTrackerStatus maps statuses and legacy values', () => {
  assert.equal(normalizeTrackerStatus('Not Started'), 'Not Started');
  assert.equal(normalizeTrackerStatus('In Progress'), 'In Progress');
  assert.equal(normalizeTrackerStatus('Preparing'), 'In Progress');
  assert.equal(normalizeTrackerStatus('Applied'), 'Submitted');
  assert.equal(normalizeTrackerStatus('Approved'), 'Completed');
  assert.equal(normalizeTrackerStatus('Rejected'), 'Submitted');
  assert.equal(normalizeTrackerStatus('bogus'), 'Not Started');
  assert.equal(normalizeTrackerStatus(undefined), 'Not Started');
});

test('documentProgress counts unique valid indexes only', () => {
  assert.deepEqual(documentProgress({ documents: [1, 2, 3] }, { checked: [0, 2, 2, 7, -1] }), { checked: 2, total: 3, percent: 67 });
  assert.deepEqual(documentProgress(null, undefined), { checked: 0, total: 0, percent: 0 });
});

test('sanitizeSession drops unknown and sensitive keys and caps story length', () => {
  const s = sanitizeSession({ story: 'x'.repeat(3000), form: { state: 'Karnataka', age: '20', income: '150000', level: 'graduate', name: 'Ravi', aadhaar: '1234' }, resultsShown: true, savedAt: '2026-01-01T00:00:00.000Z', extra: 1 });
  assert.equal(s.story.length, 2000);
  assert.deepEqual(Object.keys(s.form), ['state', 'age', 'income', 'level']);
  assert.equal(s.form.state, 'Karnataka');
  assert.equal('extra' in s, false);
  assert.equal(s.resultsShown, true);
});

test('parseSession returns an empty session for invalid JSON', () => {
  const s = parseSession('not json');
  assert.equal(s.story, '');
  assert.equal(s.form.state, '');
  assert.equal(s.resultsShown, false);
});

test('profileSignature ignores surrounding whitespace and changes when a value changes', () => {
  assert.equal(profileSignature({ state: ' Karnataka ', age: '20', income: '', level: '' }, ' hi '), profileSignature({ state: 'Karnataka', age: '20' }, 'hi'));
  assert.notEqual(profileSignature({ age: '20' }, 'hi'), profileSignature({ age: '21' }, 'hi'));
});

test('isResultOutdated is false with no shown result and true only when signatures differ', () => {
  assert.equal(isResultOutdated(null, 'a'), false);
  assert.equal(isResultOutdated('a', 'a'), false);
  assert.equal(isResultOutdated('a', 'b'), true);
});

// v2 session regression coverage
import { SESSION_VERSION, SESSION_STORAGE_KEYS, buildSession, readVersionedSession, maskSensitiveIds, eraseDemoData } from './persistence.js';
test('v2 session preserves only expected fields', () => {
  const s=buildSession({story:'Student',form:{state:'Karnataka',age:'20',income:'100000',level:'UG',secret:'hidden'},savedAt:'2026-11-22'});
  assert.equal(s.version,SESSION_VERSION);
  assert.equal(s.form.state,'Karnataka');
  assert.equal('secret' in s.form,false);
  assert.equal(readVersionedSession(JSON.stringify(s)).story,'Student');
});
test('v2 masks 12-digit identifiers in story',()=>{
  assert.equal(maskSensitiveIds('ID 1234 5678 9012'),'ID [removed]');
});
test('v2 masks OTP and password tokens',()=>{
  const s=buildSession({story:'otp: 123456 password=secret'});
  assert.equal(s.story.includes('123456'),false);
  assert.equal(s.story.includes('secret'),false);
});
test('v2 ignores malformed JSON',()=>{
  assert.equal(readVersionedSession('{').story,'');
});
test('v2 rejects old and unversioned sessions',()=>{
  assert.equal(readVersionedSession(JSON.stringify({version:1,story:'old'})).story,'');
  assert.equal(readVersionedSession(JSON.stringify({story:'old'})).story,'');
});
test('erase removes session and tracker keys',()=>{
  const m=new Map(SESSION_STORAGE_KEYS.map(k=>[k,'data']));
  const storage={removeItem:k=>m.delete(k)};
  assert.equal(eraseDemoData(storage),SESSION_STORAGE_KEYS.length);
  assert.equal(m.size,0);
});

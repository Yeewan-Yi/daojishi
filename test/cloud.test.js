import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudClient, CloudError, roomFromHash, roomUrl, validateRoom, newRoom } from '../cloud.js';

const room = { id: '11111111-2222-4333-8444-555555555555', token: 'a'.repeat(64) };
const countdown = { title: '一起看海 🐚', start: '2026-10-20T00:00:00.000Z', end: '2026-11-20T00:00:00.000Z' };
const row = { ...countdown, id: room.id, version: 1, can_edit: true, viewer_token: 'b'.repeat(64) };
const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('room links use fragments and reject missing or malformed capabilities', () => {
  const link = roomUrl('https://example.com/countdown/?old=1#c=snapshot', room);
  assert.equal(new URL(link).search, '');
  assert.deepEqual(roomFromHash(new URL(link).hash), room);
  assert.equal(roomFromHash('#c=snapshot'), null);
  for (const hash of ['#room=no&key=bad', `#room=${room.id}`, `#key=${room.token}`]) assert.throws(() => roomFromHash(hash), CloudError);
  assert.throws(() => validateRoom({ ...room, token: 'a'.repeat(63) }));
});

test('generated sharing capabilities contain 256 random bits and separate room IDs', () => {
  const first = newRoom(), second = newRoom();
  assert.deepEqual(validateRoom(first), first);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.id, second.id);
});

test('create and update only send public key in apikey header, with version protection', async () => {
  const calls = [];
  const client = new CloudClient(async (url, options) => { calls.push({ url, options }); return respond(row); }, 'https://example.supabase.co/', 'sb_publishable_test');
  const result = await client.create(room, countdown);
  assert.equal(result.canEdit, true);
  assert.equal(result.viewerToken, row.viewer_token);
  await client.update(room, countdown, 7);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/youqi_create$/);
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(JSON.parse(calls[1].options.body).p_version, 7);
  assert.equal(JSON.parse(calls[0].options.body).p_token, room.token);
});

test('viewer responses never fabricate an editor token', async () => {
  const client = new CloudClient(async () => respond({ ...row, can_edit: false, viewer_token: null }));
  const result = await client.read(room);
  assert.equal(result.canEdit, false); assert.equal(result.viewerToken, null);
});

test('transport preserves the global receiver required by browser fetch', async () => {
  const client = new CloudClient(function () {
    assert.equal(this, globalThis);
    return Promise.resolve(respond(row));
  });
  await client.read(room);
});

test('reject wrong room, invalid versions and corrupt records from backend', async () => {
  for (const bad of [{ ...row, id: crypto.randomUUID() }, { ...row, version: 0 }, { ...row, version: 1.5 }, { ...row, viewer_token: null }, { ...row, title: '' }]) {
    const client = new CloudClient(async () => respond(bad));
    await assert.rejects(() => client.read(room));
  }
});

test('distinguish setup failures, forbidden links and concurrent updates', async () => {
  for (const [status, code, expected] of [[404, 'PGRST202', 'SETUP'], [403, '42501', 'ACCESS'], [409, '40001', 'CONFLICT'], [400, '23514', 'VALIDATION'], [500, 'XX000', 'SERVER']]) {
    const client = new CloudClient(async () => respond({ code }, status));
    await assert.rejects(() => client.read(room), error => error.code === expected);
  }
});

test('network failures produce a retryable failure rather than a successful save', async () => {
  const client = new CloudClient(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => client.update(room, countdown, 1), error => error.code === 'NETWORK');
});

test('aborted reads propagate cancellation to transport', async () => {
  const abort = new AbortController(); abort.abort();
  const client = new CloudClient(async (url, options) => { assert.equal(options.signal.aborted, true); throw new Error('aborted'); });
  await assert.rejects(() => client.read(room, abort.signal), error => error.code === 'NETWORK');
});

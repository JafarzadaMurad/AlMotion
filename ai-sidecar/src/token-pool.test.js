import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TokenPool, COOLDOWNS } from './token-pool.js';

const tokens = () => [
  { id: 'a', label: 'A', token: 'tok-a' },
  { id: 'b', label: 'B', token: 'tok-b' },
];

describe('TokenPool', () => {
  test('spreads load round-robin instead of exhausting the first token', () => {
    const pool = new TokenPool(tokens());
    assert.equal(pool.pick().id, 'a');
    assert.equal(pool.pick().id, 'b');
    assert.equal(pool.pick().id, 'a');
  });

  test('drops entries with no token rather than picking a blank one', () => {
    const pool = new TokenPool([{ id: 'a', token: '' }, { id: 'b', token: 'tok-b' }]);
    assert.equal(pool.available().length, 1);
    assert.equal(pool.pick().id, 'b');
  });

  test('benches a rate-limited token and serves the other', () => {
    const pool = new TokenPool(tokens());
    const now = 1_000_000;
    pool.reportFailure('a', 'rate_limited', '429', now);
    assert.deepEqual(pool.available(now).map((t) => t.id), ['b']);
  });

  test('benches a rejected token for longer than a rate limit', () => {
    // An expired token will still be expired in fifteen minutes; retrying it
    // that soon just burns a request.
    assert.ok(COOLDOWNS.AUTH_COOLDOWN_MS > COOLDOWNS.RATE_LIMIT_COOLDOWN_MS);
  });

  test('returns a benched token to service once its cooldown passes', () => {
    const pool = new TokenPool(tokens());
    const now = 1_000_000;
    pool.reportFailure('a', 'rate_limited', '429', now);
    assert.equal(pool.available(now + COOLDOWNS.RATE_LIMIT_COOLDOWN_MS + 1).length, 2);
  });

  test('does not bench on an unknown failure', () => {
    // A malformed request is the caller's fault; taking the pool down for it
    // would turn one bad request into an outage.
    const pool = new TokenPool(tokens());
    const now = 1_000_000;
    pool.reportFailure('a', 'unknown', 'socket hang up', now);
    assert.equal(pool.available(now).length, 2);
  });

  test('returns null when every token is benched, so the caller can fall back', () => {
    const pool = new TokenPool(tokens());
    const now = 1_000_000;
    pool.reportFailure('a', 'auth', '401', now);
    pool.reportFailure('b', 'auth', '401', now);
    assert.equal(pool.pick(now), null);
  });

  test('a success clears an earlier bench', () => {
    const pool = new TokenPool(tokens());
    const now = 1_000_000;
    pool.reportFailure('a', 'rate_limited', '429', now);
    pool.reportSuccess('a', now);
    assert.equal(pool.available(now).length, 2);
  });

  test('keeps cooldowns across a token-list refresh', () => {
    // The list is re-sent on every request; forgetting cooldowns would hammer
    // a rate-limited token forever.
    const pool = new TokenPool(tokens());
    const now = 1_000_000;
    pool.reportFailure('a', 'rate_limited', '429', now);
    pool.replace(tokens());
    assert.deepEqual(pool.available(now).map((t) => t.id), ['b']);
  });

  test('never exposes the token itself in status', () => {
    const pool = new TokenPool(tokens());
    const status = JSON.stringify(pool.status());
    assert.ok(!status.includes('tok-a'));
    assert.ok(status.includes('"label":"A"'));
  });
});

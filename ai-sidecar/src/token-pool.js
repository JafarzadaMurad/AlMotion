/**
 * Round-robin pool of subscription tokens with cooldowns.
 *
 * A subscription's rate limit is sized for one person's day of work, and an
 * editor with several people in it will hit that. Running out is designed for
 * rather than hoped against: a token that reports a limit is benched, the next
 * one takes over, and when all are benched the caller falls back to the API
 * key. Running out costs money, never function.
 */

const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const AUTH_COOLDOWN_MS = 60 * 60 * 1000;

export class TokenPool {
  constructor(tokens = []) {
    this.replace(tokens);
  }

  /** Swap the token list, keeping cooldowns for tokens that are still present. */
  replace(tokens) {
    const previous = new Map((this.tokens ?? []).map((entry) => [entry.id, entry]));
    this.tokens = (tokens ?? [])
      .filter((entry) => entry && entry.token)
      .map((entry, index) => {
        const id = entry.id ?? `token-${index}`;
        return {
          id,
          label: entry.label ?? id,
          token: entry.token,
          cooldownUntil: previous.get(id)?.cooldownUntil ?? 0,
          lastError: previous.get(id)?.lastError ?? null,
        };
      });
    this.cursor = 0;
  }

  available(now = Date.now()) {
    return this.tokens.filter((entry) => entry.cooldownUntil <= now);
  }

  /**
   * Next usable token, or null when every one is benched. Round-robin rather
   * than always-first, so a two-token pool actually spreads load instead of
   * exhausting one and then discovering the other.
   */
  pick(now = Date.now()) {
    const usable = this.available(now);
    if (usable.length === 0) return null;
    const chosen = usable[this.cursor % usable.length];
    this.cursor = (this.cursor + 1) % Math.max(1, usable.length);
    return chosen;
  }

  /** Bench a token after a failure. Unknown errors do not bench — they are usually the request, not the token. */
  reportFailure(id, kind, message, now = Date.now()) {
    const entry = this.tokens.find((candidate) => candidate.id === id);
    if (!entry) return;

    entry.lastError = { kind, message: String(message ?? '').slice(0, 300), at: now };
    if (kind === 'rate_limited') entry.cooldownUntil = now + RATE_LIMIT_COOLDOWN_MS;
    if (kind === 'auth') entry.cooldownUntil = now + AUTH_COOLDOWN_MS;
  }

  reportSuccess(id, now = Date.now()) {
    const entry = this.tokens.find((candidate) => candidate.id === id);
    if (!entry) return;
    entry.cooldownUntil = 0;
    entry.lastError = null;
    entry.lastOkAt = now;
  }

  /** Status for the admin page. Never includes the token itself. */
  status(now = Date.now()) {
    return this.tokens.map((entry) => ({
      id: entry.id,
      label: entry.label,
      available: entry.cooldownUntil <= now,
      cooldownRemainingMs: Math.max(0, entry.cooldownUntil - now),
      lastError: entry.lastError,
      lastOkAt: entry.lastOkAt ?? null,
    }));
  }
}

export const COOLDOWNS = { RATE_LIMIT_COOLDOWN_MS, AUTH_COOLDOWN_MS };

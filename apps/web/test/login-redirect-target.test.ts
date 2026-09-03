import { describe, it, expect, afterEach } from 'vitest';
import { getSafeRedirectTarget, getSetPasswordUrl } from '../lib/login-redirect';

function setSearch(search: string) {
  window.history.pushState({}, '', `/login${search}`);
}

describe('getSafeRedirectTarget', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/login');
  });

  it('returns "/" when there is no "from" param', () => {
    setSearch('');
    expect(getSafeRedirectTarget()).toBe('/');
  });

  it('returns the deep-link path+query from the NFC flow (?from=/training?m=entrenamiento&a=confirmar)', () => {
    setSearch('?from=%2Ftraining%3Fm%3Dentrenamiento%26a%3Dconfirmar');
    expect(getSafeRedirectTarget()).toBe('/training?m=entrenamiento&a=confirmar');
  });

  it('falls back to "/" for a protocol-relative "from" (open-redirect attempt via //evil.com)', () => {
    setSearch('?from=%2F%2Fevil.com');
    expect(getSafeRedirectTarget()).toBe('/');
  });

  it('falls back to "/" for an absolute external "from" (open-redirect attempt)', () => {
    setSearch('?from=https%3A%2F%2Fevil.com');
    expect(getSafeRedirectTarget()).toBe('/');
  });

  it('falls back to "/" for a "from" that does not start with a slash', () => {
    setSearch('?from=training');
    expect(getSafeRedirectTarget()).toBe('/');
  });
});

describe('getSetPasswordUrl', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/login');
  });

  it('forwards the pending deep-link as ?from= on /set-password', () => {
    setSearch('?from=%2Ftraining%3Fm%3Dentrenamiento%26a%3Dconfirmar');
    expect(getSetPasswordUrl()).toBe('/set-password?from=%2Ftraining%3Fm%3Dentrenamiento%26a%3Dconfirmar');
  });

  it('defaults to forwarding "/" when there is no pending deep-link', () => {
    setSearch('');
    expect(getSetPasswordUrl()).toBe('/set-password?from=%2F');
  });
});

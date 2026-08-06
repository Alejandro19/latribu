import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('geo routes', () => {
  const app = createApp();

  it('returns countries split into priority and rest groups', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).toBe(200);
    expect(res.body.data.priority.some((c: { isoCode: string }) => c.isoCode === 'CO')).toBe(true);
    expect(res.body.data.rest.length).toBeGreaterThan(0);
  });

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).not.toBe(401);
  });

  it('returns a sorted, deduplicated list of cities for a country', async () => {
    const res = await request(app).get('/api/cities/MX');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const sorted = [...res.body.data].sort((a: string, b: string) => a.localeCompare(b, 'es'));
    expect(res.body.data).toEqual(sorted);
  });

  it('returns an empty array for an unknown country code', async () => {
    const res = await request(app).get('/api/cities/ZZ');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

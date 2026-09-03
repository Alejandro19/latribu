import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('middleware', () => {
  it('redirects to /login preserving the deep-link query string when there is no token', () => {
    const req = new NextRequest('http://localhost:3000/training?m=entrenamiento&a=confirmar');
    const res = middleware(req);
    const location = res.headers.get('location');
    expect(location).not.toBeNull();
    const url = new URL(location as string);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('from')).toBe('/training?m=entrenamiento&a=confirmar');
  });

  it('redirects to /login with just the pathname in "from" when there is no query string', () => {
    const req = new NextRequest('http://localhost:3000/training');
    const res = middleware(req);
    const url = new URL(res.headers.get('location') as string);
    expect(url.searchParams.get('from')).toBe('/training');
  });

  it('lets the request through (no redirect) when a session token cookie is present', () => {
    const req = new NextRequest('http://localhost:3000/training?m=entrenamiento&a=confirmar');
    req.cookies.set('latribu_token', 'fake-token');
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('never redirects public paths like /login itself', () => {
    const req = new NextRequest('http://localhost:3000/login?m=entrenamiento&a=confirmar');
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});

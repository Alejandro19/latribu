import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../src/middleware/require-permission.middleware.js';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('requirePermission', () => {
  it('always allows admins', () => {
    const req = { user: { role: 'admin' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks lead_wellness clients from LEAD_BLOCKED_MODULES', () => {
    const req = { user: { role: 'cliente' }, client: { clientType: 'lead_wellness', permissions: {} } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a coaching client with no explicit permissions.training key', () => {
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1', permissions: {} } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks a client whose permissions.training is explicitly false', () => {
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1', permissions: { training: false } } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

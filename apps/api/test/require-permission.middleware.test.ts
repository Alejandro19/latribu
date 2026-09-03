import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { requirePermission } from '../src/middleware/require-permission.middleware.js';
import * as typeModuleAccess from '../src/services/type-module-access.service.js';

vi.mock('../src/services/type-module-access.service.js');

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always allows admins, without consulting the matrix', async () => {
    const req = { user: { role: 'admin' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
    expect(typeModuleAccess.isModuleAllowedForType).not.toHaveBeenCalled();
  });

  it('always allows terapeutas — la matriz es por tipo de cliente, no les aplica', async () => {
    const req = { user: { role: 'terapeuta' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('blindspot')(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
  });

  it('blocks a client whose type the matrix does not allow for this module', async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockResolvedValue(false);
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1', permissions: {} } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    await flushPromises();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(typeModuleAccess.isModuleAllowedForType).toHaveBeenCalledWith('coaching_1_1', 'training');
  });

  it('allows a client whose type the matrix allows, with no explicit individual permissions.training key', async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockResolvedValue(true);
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1', permissions: {} } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
  });

  it("aliases 'supplementation' to the 'nutrition' matrix row — there is no separate row for it in the admin screen", async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockResolvedValue(true);
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1', permissions: {} } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('supplementation')(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
    expect(typeModuleAccess.isModuleAllowedForType).toHaveBeenCalledWith('coaching_1_1', 'nutrition');
  });

  it('blocks a client whose type is allowed by the matrix but whose individual permissions.training is explicitly false', async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockResolvedValue(true);
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1', permissions: { training: false } } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePermission('training')(req, res, next);
    await flushPromises();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { requirePersonalInfoAccess } from '../src/middleware/require-personal-info-access.middleware.js';
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

describe('requirePersonalInfoAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always allows admins', async () => {
    const req = { user: { role: 'admin' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePersonalInfoAccess(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
  });

  it('blocks a client whose type has neither personal_info nor personal_info_mentoring allowed', async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockResolvedValue(false);
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePersonalInfoAccess(req, res, next);
    await flushPromises();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a client whose type has the standard variant allowed', async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockImplementation(async (_type, key) => key === 'personal_info');
    const req = { user: { role: 'cliente' }, client: { clientType: 'coaching_1_1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePersonalInfoAccess(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
  });

  it('allows a client whose type has only the mentoring variant allowed', async () => {
    vi.mocked(typeModuleAccess.isModuleAllowedForType).mockImplementation(async (_type, key) => key === 'personal_info_mentoring');
    const req = { user: { role: 'cliente' }, client: { clientType: 'mentoring' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requirePersonalInfoAccess(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalled();
  });
});

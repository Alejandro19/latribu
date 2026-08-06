import { describe, it, expect } from 'vitest';
import { LoginInputSchema, RegisterInputSchema, ChangePasswordInputSchema, GoogleAuthInputSchema } from '../src/auth.js';

describe('auth schemas', () => {
  it('accepts a valid login input', () => {
    const result = LoginInputSchema.safeParse({ email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a login input with an invalid email', () => {
    const result = LoginInputSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid register input', () => {
    const result = RegisterInputSchema.safeParse({ name: 'Ana', email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a register input missing the name', () => {
    const result = RegisterInputSchema.safeParse({ email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid change-password input', () => {
    const result = ChangePasswordInputSchema.safeParse({ currentPassword: 'old', newPassword: 'new' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid google auth input', () => {
    const result = GoogleAuthInputSchema.safeParse({ credential: 'a.b.c' });
    expect(result.success).toBe(true);
  });

  it('rejects a google auth input with an empty credential', () => {
    const result = GoogleAuthInputSchema.safeParse({ credential: '' });
    expect(result.success).toBe(false);
  });
});

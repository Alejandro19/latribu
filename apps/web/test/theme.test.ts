import { describe, it, expect } from 'vitest';
import { screenForPathname, resolveTheme, isBrandLockedScreen } from '../lib/theme';

describe('screenForPathname / resolveTheme', () => {
  it('treats /configuracion as a toggleable module — regression: used to be forced to dark-brand regardless of the toggle', () => {
    expect(screenForPathname('/configuracion')).toBe('module');
    expect(isBrandLockedScreen(screenForPathname('/configuracion'))).toBe(false);
    expect(resolveTheme(screenForPathname('/configuracion'), 'light')).toBe('light-premium');
    expect(resolveTheme(screenForPathname('/configuracion'), 'dark')).toBe('dark-carbon');
  });

  it('also recognizes nested /configuracion routes (e.g. /configuracion/membresias)', () => {
    expect(screenForPathname('/configuracion/membresias')).toBe('module');
  });

  it('treats the home screen ("/") as a toggleable module — regression: used to be forced to dark-brand regardless of the toggle', () => {
    expect(screenForPathname('/')).toBe('module');
    expect(isBrandLockedScreen(screenForPathname('/'))).toBe(false);
    expect(resolveTheme(screenForPathname('/'), 'light')).toBe('light-premium');
    expect(resolveTheme(screenForPathname('/'), 'dark')).toBe('dark-carbon');
  });

  it('still treats an uncovered route (e.g. admin) as brand-locked dark-brand', () => {
    expect(screenForPathname('/admin')).toBe('dashboard');
    expect(resolveTheme('dashboard', 'light')).toBe('dark-brand');
  });

  it('keeps login brand-locked', () => {
    expect(screenForPathname('/login')).toBe('login');
    expect(resolveTheme('login', 'light')).toBe('dark-brand');
  });

  it('resolves one of the 8 reskinned modules to the toggled theme', () => {
    expect(screenForPathname('/training')).toBe('module');
    expect(resolveTheme(screenForPathname('/training'), 'light')).toBe('light-premium');
  });
});

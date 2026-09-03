import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../components/layout/ThemeToggle';
import { useThemeMode } from '../components/layout/ThemeRoot';

vi.mock('../components/layout/ThemeRoot', () => ({ useThemeMode: vi.fn() }));

function mockMode(mode: 'light' | 'dark', isBrandLocked = false) {
  vi.mocked(useThemeMode).mockReturnValue({
    mode,
    theme: mode === 'light' ? 'light-premium' : 'dark-carbon',
    isBrandLocked,
    toggleMode: vi.fn(),
  });
}

describe('ThemeToggle', () => {
  it('renders as a button with no visible text — state is conveyed by icon/aria only', () => {
    mockMode('dark');
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('');
  });

  it('marks aria-pressed=true and labels "Modo claro" in light mode', () => {
    mockMode('light');
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Modo claro' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks aria-pressed=false and labels "Modo carbón" in dark mode', () => {
    mockMode('dark');
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Modo carbón' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls toggleMode when clicked', () => {
    mockMode('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(useThemeMode().toggleMode).toHaveBeenCalled();
  });

  it('renders nothing on brand-locked screens (Login, Splash, Dashboard)', () => {
    mockMode('dark', true);
    const { container } = render(<ThemeToggle />);
    expect(container).toBeEmptyDOMElement();
  });
});

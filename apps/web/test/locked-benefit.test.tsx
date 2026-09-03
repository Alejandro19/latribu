import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LockedBenefit from '../components/ui/LockedBenefit';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LockedBenefit', () => {
  it('shows the single "Disponible en Premium" copy naming the benefit', () => {
    render(<LockedBenefit benefit="reservar retiros" />);
    expect(screen.getByText('Disponible en Premium')).toBeInTheDocument();
    expect(screen.getByText('Disponible en Premium: reservar retiros y más.')).toBeInTheDocument();
  });

  it('opens the coach WhatsApp link on CTA click', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<LockedBenefit benefit="reservar retiros" />);
    await user.click(screen.getByRole('button', { name: 'Hablar con tu coach' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank');
  });
});

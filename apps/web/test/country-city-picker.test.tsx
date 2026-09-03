import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CountryCityPicker } from '../components/onboarding/CountryCityPicker';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/geo-client');

describe('CountryCityPicker', () => {
  beforeEach(() => {
    vi.mocked(geoClient.getCountries).mockResolvedValue({
      priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }],
      rest: [{ isoCode: 'MX', name: 'México', flag: '🇲🇽', phonecode: '52' }],
    });
    vi.mocked(geoClient.getCities).mockResolvedValue(['Bogotá', 'Medellín']);
  });

  it('renders the fetched countries and disables the city input until a country is chosen', async () => {
    render(<CountryCityPicker value={{ country: '', city: '', phoneCode: '+57', phoneNumber: '' }} onChange={vi.fn()} />);
    expect(await screen.findByRole('option', { name: /Colombia/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Ciudad')).toBeDisabled();
  });

  it('fetches cities and calls onChange when the country changes', async () => {
    const onChange = vi.fn();
    render(<CountryCityPicker value={{ country: '', city: '', phoneCode: '+57', phoneNumber: '' }} onChange={onChange} />);
    await screen.findByRole('option', { name: /Colombia/ });
    fireEvent.change(screen.getByLabelText('País de residencia'), { target: { value: 'CO' } });
    expect(onChange).toHaveBeenCalledWith({ country: 'CO', city: '' });
    await waitFor(() => expect(geoClient.getCities).toHaveBeenCalledWith('CO'));
  });

  it('calls onChange when the phone number changes', async () => {
    const onChange = vi.fn();
    render(<CountryCityPicker value={{ country: 'CO', city: '', phoneCode: '+57', phoneNumber: '' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), { target: { value: '3001234567' } });
    expect(onChange).toHaveBeenCalledWith({ phoneNumber: '3001234567' });
  });
});

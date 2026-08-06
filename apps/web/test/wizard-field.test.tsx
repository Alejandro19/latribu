// apps/web/test/wizard-field.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardField } from '../components/onboarding/WizardField';
import type { WizardFieldConfig } from '@latribu/shared-types';

describe('WizardField', () => {
  it('renders nothing when hidden is true', () => {
    const field: WizardFieldConfig = { id: 'condition_other', label: 'Especifica', type: 'text', required: true };
    const { container } = render(<WizardField field={field} value="" hidden onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onChange with the selected option for a select field', () => {
    const field: WizardFieldConfig = { id: 'gender', label: 'Género', type: 'select', options: ['Masculino', 'Femenino'], required: true };
    const onChange = vi.fn();
    render(<WizardField field={field} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Género'), { target: { value: 'Femenino' } });
    expect(onChange).toHaveBeenCalledWith('gender', 'Femenino');
  });

  it('toggles a chip option in and out of the selected array', () => {
    const field: WizardFieldConfig = { id: 'proteins', label: 'Proteínas', type: 'chips', options: ['Pollo', 'Res'], required: true };
    const onChange = vi.fn();
    render(<WizardField field={field} value={['Pollo']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Res'));
    expect(onChange).toHaveBeenCalledWith('proteins', ['Pollo', 'Res']);
    fireEvent.click(screen.getByLabelText('Pollo'));
    expect(onChange).toHaveBeenCalledWith('proteins', []);
  });

  it('shows an extra "otro" text input once "Otro" is selected in a chips field', () => {
    const field: WizardFieldConfig = { id: 'proteins', label: 'Proteínas', type: 'chips', options: ['Pollo', 'Otro'], required: true };
    render(<WizardField field={field} value={['Otro']} otroValue="Tofu" onChange={vi.fn()} onOtroChange={vi.fn()} />);
    expect(screen.getByLabelText('Especifica Proteínas')).toHaveValue('Tofu');
  });

  it('calls onChange with the clicked number for a segmented field', () => {
    const field: WizardFieldConfig = { id: 'meals_per_day', label: 'Comidas', type: 'segmented', min: 1, max: 3, required: true };
    const onChange = vi.fn();
    render(<WizardField field={field} value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('2'));
    expect(onChange).toHaveBeenCalledWith('meals_per_day', '2');
  });

  it('renders an alert when invalid is true', () => {
    const field: WizardFieldConfig = { id: 'occupation', label: 'Ocupación', type: 'text', required: true };
    render(<WizardField field={field} value="" invalid onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

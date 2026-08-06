import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdminNutritionPanel } from '../components/nutrition/AdminNutritionPanel';
import * as nutritionClient from '../lib/nutrition-client';
import * as supplementsClient from '../lib/supplements-client';

vi.mock('../lib/nutrition-client');
vi.mock('../lib/supplements-client');
vi.mock('../components/layout/AppShell', () => ({
  showToast: vi.fn(),
}));

describe('AdminNutritionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: {}, meals: [] });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('loads and shows the current plan', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: { dailyCals: 2200, summary: 'Perfil: Hombre' },
      meals: [],
    });
    render(<AdminNutritionPanel clientId="client-1" />);
    expect(await screen.findByLabelText('Calorías')).toHaveValue(2200);
    expect(screen.getByDisplayValue('Perfil: Hombre')).toBeInTheDocument();
  });

  it('saves macros, summary, menu, recommendations and closing message in one Guardar plan click', async () => {
    vi.mocked(nutritionClient.saveNutritionPlan).mockResolvedValue({});
    render(<AdminNutritionPanel clientId="client-1" />);
    await screen.findByLabelText('Calorías');

    fireEvent.change(screen.getByLabelText('Calorías'), { target: { value: '2000' } });
    fireEvent.change(screen.getByPlaceholderText('Nombre de la comida (ej. Desayuno)'), { target: { value: 'Desayuno' } });
    fireEvent.change(screen.getByLabelText('Opción 1 (un alimento por línea)'), { target: { value: 'Avena\nHuevos' } });
    fireEvent.change(screen.getByLabelText('Recomendaciones adicionales (una por línea)'), { target: { value: 'Tomar agua\nDormir bien' } });
    fireEvent.change(screen.getByLabelText('Mensaje de cierre (cita del PDF)'), { target: { value: 'Confía en el proceso.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));

    await waitFor(() =>
      expect(nutritionClient.saveNutritionPlan).toHaveBeenCalledWith(
        'client-1',
        expect.objectContaining({
          daily_cals: 2000,
          menu_plan: [
            {
              name: 'Desayuno',
              options: [
                { label: 'Opción 1', items: ['Avena', 'Huevos'] },
                { label: 'Opción 2', items: [] },
              ],
            },
          ],
          recommendations: ['Tomar agua', 'Dormir bien'],
          closing_message: 'Confía en el proceso.',
        })
      )
    );
  });

  it('adding a meal row shows a second Opción 1 / Opción 2 pair', async () => {
    render(<AdminNutritionPanel clientId="client-1" />);
    await screen.findByLabelText('Calorías');
    expect(screen.getAllByLabelText('Opción 1 (un alimento por línea)')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar comida' }));
    expect(screen.getAllByLabelText('Opción 1 (un alimento por línea)')).toHaveLength(2);
  });

  it('saves supplement rows and only deletes removed ones after Guardar plan', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Creatina', brand: 'MarcaX', dose: '5g', timing: 'Mañana', benefit: null, category: null, active: true },
    ]);
    vi.mocked(nutritionClient.saveNutritionPlan).mockResolvedValue({});
    render(<AdminNutritionPanel clientId="client-1" />);
    await screen.findByDisplayValue('Creatina');

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar suplemento' }));
    const names = screen.getAllByPlaceholderText('Nombre del suplemento');
    fireEvent.change(names[1], { target: { value: 'Omega 3' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));

    await waitFor(() => expect(supplementsClient.updateSupplement).toHaveBeenCalledWith('client-1', 's1', expect.objectContaining({ name: 'Creatina' })));
    expect(supplementsClient.createSupplement).toHaveBeenCalledWith('client-1', expect.objectContaining({ name: 'Omega 3' }));
    expect(supplementsClient.deleteSupplement).not.toHaveBeenCalled();
  });

  it('removing an existing supplement row only calls deleteSupplement after Guardar plan', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Creatina', brand: null, dose: null, timing: null, benefit: null, category: null, active: true },
    ]);
    vi.mocked(nutritionClient.saveNutritionPlan).mockResolvedValue({});
    render(<AdminNutritionPanel clientId="client-1" />);
    const supplementRow = (await screen.findByDisplayValue('Creatina')).closest('div') as HTMLElement;

    fireEvent.click(within(supplementRow).getByRole('button', { name: 'Eliminar' }));
    expect(supplementsClient.deleteSupplement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));
    await waitFor(() => expect(supplementsClient.deleteSupplement).toHaveBeenCalledWith('client-1', 's1'));
  });
});

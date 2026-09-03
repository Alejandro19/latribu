import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { ClientNutritionPanel } from '../components/nutrition/ClientNutritionPanel';
import * as nutritionClient from '../lib/nutrition-client';
import * as supplementsClient from '../lib/supplements-client';
import * as nutritionTipsClient from '../lib/nutrition-tips-client';
import * as recipesClient from '../lib/recipes-client';

vi.mock('../lib/nutrition-client');
vi.mock('../lib/supplements-client');
vi.mock('../lib/nutrition-tips-client');
vi.mock('../lib/recipes-client');

describe('ClientNutritionPanel', () => {
  beforeEach(() => {
    vi.mocked(nutritionTipsClient.listActiveTips).mockResolvedValue([]);
    vi.mocked(recipesClient.listActiveRecipes).mockResolvedValue([]);
  });

  it('shows the assigned macros and the first meal of the menu', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: {
        dailyCals: 2200,
        proteinG: 160,
        menuPlan: [
          { name: 'Desayuno', options: [{ label: 'Opción 1', items: ['Avena', 'Huevos'] }, { label: 'Opción 2', items: ['Yogurt'] }] },
        ],
      },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getAllByText('160').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Desayuno').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Avena').length).toBeGreaterThan(0);
  });

  it('shows the 3 macro cards (Proteína/Carbohidrato/Grasa) and no fabricated goal, water card, or old hero', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: {
        dailyCals: 2200,
        proteinG: 160,
        carbsG: 220,
        fatG: 60,
        menuPlan: [{ name: 'Desayuno', options: [{ label: 'Opción 1', items: ['Avena'] }] }],
      },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientNutritionPanel clientId="client-1" />);
    expect(await screen.findByText('Proteína')).toBeInTheDocument();
    expect(screen.getByText('Carbohidrato')).toBeInTheDocument();
    expect(screen.getByText('Grasa')).toBeInTheDocument();
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('220')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    // Ningún macro de Agua (no existe el dato) ni la vieja meta/hero fabricados.
    expect(screen.queryByText('Agua')).not.toBeInTheDocument();
    expect(screen.queryByText('Meta nutricional diaria')).not.toBeInTheDocument();
    expect(screen.queryByText('Tu objetivo · hoy')).not.toBeInTheDocument();
  });

  it('shows the "Tips and tricks" section with the active tips from the admin-managed library', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: { dailyCals: 2000 },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    vi.mocked(nutritionTipsClient.listActiveTips).mockResolvedValue([
      { id: 't1', content: 'Prepara tus comidas con anticipación.', active: true },
    ]);
    render(<ClientNutritionPanel clientId="client-1" />);
    expect(await screen.findByText('Tips and tricks')).toBeInTheDocument();
    expect(screen.getByText('Prepara tus comidas con anticipación.')).toBeInTheDocument();
  });

  it('shows the "Recetas saludables" section with a link to view and download each PDF', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: { dailyCals: 2000 },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    vi.mocked(recipesClient.listActiveRecipes).mockResolvedValue([
      { id: 'r1', name: 'Bowl de proteína', category: 'Almuerzo', pdfUrl: 'https://files.example.com/bowl.pdf', pdfName: 'bowl.pdf', active: true },
    ]);
    render(<ClientNutritionPanel clientId="client-1" />);
    expect(await screen.findByText('Recetas saludables')).toBeInTheDocument();
    expect(screen.getByText('Bowl de proteína')).toBeInTheDocument();
    const verLink = screen.getByRole('link', { name: 'Ver' });
    expect(verLink).toHaveAttribute('href', 'https://files.example.com/bowl.pdf');
    const downloadLink = screen.getByRole('link', { name: 'Descargar' });
    expect(downloadLink).toHaveAttribute('download', 'bowl.pdf');
  });

  it('shows a message when no plan has been assigned yet', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: {}, meals: [] });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Todavía no tienes un plan de nutrición asignado.')).toBeInTheDocument());
  });

  it('reveals the rest of the meals when Ver más is clicked', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: {
        menuPlan: [
          { name: 'Desayuno', options: [{ label: 'Opción 1', items: ['Avena'] }, { label: 'Opción 2', items: [] }] },
          { name: 'Almuerzo', options: [{ label: 'Opción 1', items: ['Pollo'] }, { label: 'Opción 2', items: [] }] },
        ],
      },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientNutritionPanel clientId="client-1" />);
    await screen.findByText('Desayuno');
    expect(screen.queryByText('Almuerzo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver más/ }));
    expect(screen.getByText('Almuerzo')).toBeInTheDocument();
  });

  it('shows the assigned supplements with dose and timing', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: { dailyCals: 2000 }, meals: [] });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Creatina', brand: null, dose: '5g', timing: 'Mañana', benefit: null, category: null, active: true },
    ]);
    render(<ClientNutritionPanel clientId="client-1" />);
    expect(await screen.findByText('Creatina')).toBeInTheDocument();
    expect(screen.getByText('5g · Mañana')).toBeInTheDocument();
    expect(screen.getByText('Mañana', { selector: 'span' })).toBeInTheDocument();
  });

  it('downloads the nutrition plan PDF by opening a branded print window with the plan content', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: {
        dailyCals: 2000,
        menuPlan: [{ name: 'Desayuno', options: [{ label: 'Opción 1', items: ['Avena'] }] }],
      },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    const write = vi.fn();
    const print = vi.fn();
    const fakeWindow = { document: { write, close: vi.fn() }, focus: vi.fn(), print };
    vi.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window);

    render(<ClientNutritionPanel clientId="client-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Plan nutricional'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Desayuno'));
    // El header del PDF usa el lockup real de marca (isotipo + wordmark en
    // SVG), no el texto plano "Ephirox" de antes.
    expect(write).toHaveBeenCalledWith(expect.stringContaining('viewBox="0 0 530 132"'));
    await waitFor(() => expect(print).toHaveBeenCalled());
  });

  it('shows a LockedBenefit upgrade card when the module is not allowed for this client type (403)', async () => {
    const { PermissionDeniedError } = await import('../lib/api-client');
    vi.mocked(nutritionClient.getNutrition).mockRejectedValue(new PermissionDeniedError('No tienes acceso a este módulo.'));
    render(<ClientNutritionPanel clientId="client-1" />);
    expect(await screen.findByText('Disponible en Premium')).toBeInTheDocument();
  });
});

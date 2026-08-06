import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientNutritionPanel } from '../components/nutrition/ClientNutritionPanel';
import * as nutritionClient from '../lib/nutrition-client';
import * as supplementsClient from '../lib/supplements-client';

vi.mock('../lib/nutrition-client');
vi.mock('../lib/supplements-client');

describe('ClientNutritionPanel', () => {
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
    await waitFor(() => expect(screen.getAllByText(/2200/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('Desayuno').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Avena').length).toBeGreaterThan(0);
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

  it('downloads the supplements PDF by opening a print window with the supplements table', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: { dailyCals: 2000 }, meals: [] });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Creatina', brand: 'MarcaX', dose: '5g', timing: 'Mañana', benefit: null, category: 'rendimiento', active: true },
    ]);
    const write = vi.fn();
    const print = vi.fn();
    const fakeWindow = { document: { write, close: vi.fn() }, focus: vi.fn(), print };
    vi.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window);

    render(<ClientNutritionPanel clientId="client-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Creatina'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('rendimiento'));
    expect(print).toHaveBeenCalled();
  });

  it('shows a link to the PDF when the plan has one', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: { dailyCals: 2000, pdfUrl: 'https://x.co/plan.pdf', pdfName: 'plan.pdf', menuPlan: [{ name: 'Desayuno', options: [] }] },
      meals: [],
    });
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'plan.pdf' })).toHaveAttribute('href', 'https://x.co/plan.pdf'));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { AdminTrainingPanel } from '../components/training/AdminTrainingPanel';
import type { Exercise } from '../lib/training-client';
import * as trainingClient from '../lib/training-client';
import * as quotesClient from '../lib/quotes-client';

vi.mock('../lib/training-client');
vi.mock('../lib/quotes-client');
vi.mock('../components/layout/AppShell', () => ({
  showToast: vi.fn(),
}));

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e1',
    clientId: 'c1',
    title: 'Sentadilla',
    dayNumber: 1,
    category: 'strength',
    series: 4,
    reps: '10',
    duration: null,
    restTime: '01:00',
    youtubeUrl: null,
    description: null,
    recommendations: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe('AdminTrainingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trainingClient.getClientTrainingDays).mockResolvedValue(4);
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise()]);
    vi.mocked(trainingClient.getAchievements).mockResolvedValue([]);
    vi.mocked(trainingClient.getStreak).mockResolvedValue({
      streakWeeks: 0,
      sessionsDoneThisWeek: 0,
      sessionsRequiredThisWeek: 0,
      protectorAvailable: false,
      protectorUsedThisWeek: false,
      atRisk: false,
    });
    vi.mocked(quotesClient.listQuotes).mockResolvedValue([
      { id: 'q1', quote: 'Frase corta', author: null, active: true },
    ]);
    vi.mocked(quotesClient.getClientAssignedQuoteId).mockResolvedValue(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('lists the fetched exercises in read mode', async () => {
    render(<AdminTrainingPanel clientId="c1" />);
    expect(await screen.findByText('Sentadilla')).toBeInTheDocument();
    expect(screen.getByText('Fuerza')).toBeInTheDocument();
    expect(screen.getByText('Día 1')).toBeInTheDocument();
  });

  it('pre-selects the current training days and assigned quote', async () => {
    vi.mocked(quotesClient.getClientAssignedQuoteId).mockResolvedValue('q1');
    render(<AdminTrainingPanel clientId="c1" />);
    const days = (await screen.findByLabelText('Días de entrenamiento por semana')) as HTMLSelectElement;
    expect(days.value).toBe('4');
    const quote = screen.getByLabelText('Frase asignada a este cliente') as HTMLSelectElement;
    expect(quote.value).toBe('q1');
  });

  it('changing the header selects does not call the backend until Guardar todo is clicked', async () => {
    render(<AdminTrainingPanel clientId="c1" />);
    const days = await screen.findByLabelText('Días de entrenamiento por semana');
    fireEvent.change(days, { target: { value: '5' } });
    expect(trainingClient.updateTrainingDays).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar todo' }));
    await waitFor(() => expect(trainingClient.updateTrainingDays).toHaveBeenCalledWith('c1', 5));
  });

  it('adds a new row in edit mode and only persists it on Guardar todo', async () => {
    vi.mocked(trainingClient.createExercise).mockResolvedValue(exercise({ id: 'e2', title: 'Zancadas' }));
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ejercicio' }));
    const titleInput = screen.getByPlaceholderText('Título del ejercicio');
    expect(titleInput).toHaveFocus();
    fireEvent.change(titleInput, { target: { value: 'Zancadas' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar fila' }));
    expect(trainingClient.createExercise).not.toHaveBeenCalled();
    expect(screen.getByText('Zancadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar todo' }));
    await waitFor(() =>
      expect(trainingClient.createExercise).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ title: 'Zancadas', day_number: 1, category: 'strength' })
      )
    );
  });

  it('requires a title before a row can be confirmed', async () => {
    const { showToast } = await import('../components/layout/AppShell');
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ejercicio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fila' }));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('título'), 'error');
  });

  it('cancelling a brand-new row discards it entirely', async () => {
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar ejercicio' }));
    fireEvent.change(screen.getByPlaceholderText('Título del ejercicio'), { target: { value: 'Descartar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByDisplayValue('Descartar')).not.toBeInTheDocument();
  });

  it('editing an existing row and cancelling reverts its values', async () => {
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const titleInput = screen.getByDisplayValue('Sentadilla');
    fireEvent.change(titleInput, { target: { value: 'Otro nombre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Sentadilla')).toBeInTheDocument();
    expect(screen.queryByText('Otro nombre')).not.toBeInTheDocument();
  });

  it('edits an existing row and sends the update only after Guardar todo', async () => {
    vi.mocked(trainingClient.updateExercise).mockResolvedValue(exercise({ title: 'Sentadilla búlgara' }));
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByDisplayValue('Sentadilla'), { target: { value: 'Sentadilla búlgara' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fila' }));
    expect(trainingClient.updateExercise).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar todo' }));
    await waitFor(() =>
      expect(trainingClient.updateExercise).toHaveBeenCalledWith(
        'c1',
        'e1',
        expect.objectContaining({ title: 'Sentadilla búlgara' })
      )
    );
  });

  it('deleting a row asks for confirmation and only calls the backend after Guardar todo', async () => {
    vi.mocked(trainingClient.deleteExercise).mockResolvedValue(undefined);
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.queryByText('Sentadilla')).not.toBeInTheDocument();
    expect(trainingClient.deleteExercise).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar todo' }));
    await waitFor(() => expect(trainingClient.deleteExercise).toHaveBeenCalledWith('c1', 'e1'));
  });

  it('blocks Guardar todo while a row is still in edit mode', async () => {
    const { showToast } = await import('../components/layout/AppShell');
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar todo' }));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('edición'), 'error');
    expect(trainingClient.updateExercise).not.toHaveBeenCalled();
  });

  it('renders a row for every fetched exercise, even across different categories', async () => {
    vi.mocked(trainingClient.listExercises).mockResolvedValue([
      exercise({ id: 'e1', title: 'Sentadilla', category: 'strength' }),
      exercise({ id: 'e2', title: 'Plancha', category: 'core', dayNumber: 2 }),
    ]);
    render(<AdminTrainingPanel clientId="c1" />);
    await screen.findByText('Sentadilla');
    const row = screen.getByText('Plancha').closest('tr') as HTMLElement;
    expect(within(row).getByText('Core')).toBeInTheDocument();
    expect(within(row).getByText('Día 2')).toBeInTheDocument();
  });
});

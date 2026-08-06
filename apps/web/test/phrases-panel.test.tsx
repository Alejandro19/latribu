import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhrasesPanel } from '../components/admin/PhrasesPanel';
import * as phrasesClient from '../lib/phrases-client';

const samplePhrases = [
  { id: 'p1', text: 'Frase de confirmación', context: 'confirmacion', active: true },
  { id: 'p2', text: 'Frase de instagram', context: 'instagram', active: false },
];

describe('PhrasesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(phrasesClient, 'listPhrases').mockResolvedValue(samplePhrases);
  });

  it('renders the fetched phrases', async () => {
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());
    expect(screen.getByText('Frase de instagram')).toBeInTheDocument();
  });

  it('creates a phrase and refetches the list', async () => {
    const createSpy = vi.spyOn(phrasesClient, 'createPhrase').mockResolvedValue({
      id: 'p3',
      text: 'Nueva frase',
      context: 'ambas',
      active: true,
    });
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nueva frase'), { target: { value: 'Nueva frase' } });
    fireEvent.change(screen.getByLabelText('Contexto'), { target: { value: 'ambas' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar frase' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('Nueva frase', 'ambas'));
  });

  it('toggles a phrase active state', async () => {
    const updateSpy = vi.spyOn(phrasesClient, 'updatePhrase').mockResolvedValue({ ...samplePhrases[0], active: false });
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '● Activa' }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('p1', { active: false }));
  });

  it('deletes a phrase', async () => {
    const deleteSpy = vi.spyOn(phrasesClient, 'deletePhrase').mockResolvedValue(undefined);
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('p1'));
  });

  it('filters the list by context', async () => {
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    expect(screen.queryByText('Frase de confirmación')).not.toBeInTheDocument();
    expect(screen.getByText('Frase de instagram')).toBeInTheDocument();
  });

  it('blocks creating a phrase with empty text', async () => {
    const createSpy = vi.spyOn(phrasesClient, 'createPhrase');
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar frase' }));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('blocks saving an edit with empty text', async () => {
    const updateSpy = vi.spyOn(phrasesClient, 'updatePhrase');
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.change(screen.getByLabelText('Frase'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('draws a preview phrase for a context', async () => {
    const previewSpy = vi
      .spyOn(phrasesClient, 'drawPreviewPhrase')
      .mockResolvedValue({ id: 'p9', text: 'Frase de prueba', context: 'confirmacion', active: true });
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: '🔀 Probar otra' })[0]);
    await waitFor(() => expect(previewSpy).toHaveBeenCalledWith('confirmacion', undefined));
    await waitFor(() => expect(screen.getByText('Frase de prueba')).toBeInTheDocument());
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminPhrasesPage from '../app/(app)/admin/phrases/page';
import * as phrasesClient from '../lib/phrases-client';
import * as quotesClient from '../lib/quotes-client';

describe('AdminPhrasesPage', () => {
  it('renders both panels', async () => {
    vi.spyOn(phrasesClient, 'listPhrases').mockResolvedValue([]);
    vi.spyOn(quotesClient, 'listQuotes').mockResolvedValue([]);

    render(<AdminPhrasesPage />);

    expect(await screen.findByText('Frases Card RR.SS')).toBeInTheDocument();
    expect(screen.getByText('Frases de mentalidad')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminRestToolsPage from '../app/(app)/admin/rest-tools/page';
import * as restToolsClient from '../lib/rest-tools-client';

describe('AdminRestToolsPage', () => {
  it('renders the admin panel', async () => {
    vi.spyOn(restToolsClient, 'listAllRestTools').mockResolvedValue([]);
    render(<AdminRestToolsPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Herramientas para dormir' })).toBeInTheDocument();
  });
});

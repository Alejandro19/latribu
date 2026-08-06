import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminCortisolTipsPage from '../app/(app)/admin/cortisol-tips/page';
import * as cortisolTipsClient from '../lib/cortisol-tips-client';

vi.mock('../lib/cortisol-tips-client');

describe('AdminCortisolTipsPage', () => {
  it('renders the tips bank panel', async () => {
    vi.mocked(cortisolTipsClient.listTips).mockResolvedValue([]);
    render(<AdminCortisolTipsPage />);
    expect(screen.getByRole('heading', { name: 'Tips de cortisol' })).toBeInTheDocument();
    await waitFor(() => expect(cortisolTipsClient.listTips).toHaveBeenCalled());
  });
});

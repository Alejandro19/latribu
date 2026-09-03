import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminRolesPage from '../app/(app)/admin/roles/page';
import * as rolesClient from '../lib/roles-client';
import type { PermissionModuleDto, ModuleAccessMatrix, ClientTypeCounts } from '@latribu/shared-types';

vi.mock('../lib/roles-client');

const MODULES: PermissionModuleDto[] = [
  { id: '1', key: 'personal_info', label: 'Información personal', note: 'sin dispositivos y laboratorios', sortOrder: 0, isCustom: false },
  { id: '2', key: 'personal_info_mentoring', label: 'Información personal Mentoring', note: null, sortOrder: 1, isCustom: false },
  { id: '3', key: 'training', label: 'Entrenamiento', note: null, sortOrder: 2, isCustom: false },
];

const MATRIX: ModuleAccessMatrix = {
  coaching_1_1: { personal_info: true, personal_info_mentoring: false, training: true },
  mentoring: { personal_info: false, personal_info_mentoring: true, training: true },
};

const COUNTS: ClientTypeCounts = { coaching_1_1: 3, mentoring: 1, therapist: 4 };

describe('AdminRolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rolesClient.getMatrix).mockResolvedValue({ modules: MODULES, matrix: MATRIX });
    vi.mocked(rolesClient.getCounts).mockResolvedValue(COUNTS);
  });

  it('renders the header, the count cards, and the matrix', async () => {
    render(<AdminRolesPage />);
    expect(await screen.findByRole('heading', { name: 'Roles y perfiles' })).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument(); // coaching_1_1
    expect(screen.getByText('4')).toBeInTheDocument(); // terapeuta
    expect(screen.getByText('Información personal')).toBeInTheDocument();
    expect(screen.getByText('Entrenamiento')).toBeInTheDocument();
  });

  it('saves only the toggled column when its Guardar button is clicked', async () => {
    vi.mocked(rolesClient.saveMatrixColumn).mockResolvedValue(undefined);
    render(<AdminRolesPage />);
    await screen.findByText('Entrenamiento');

    // Primera columna es coaching_1_1 — desmarca "Entrenamiento" ahí.
    fireEvent.click(screen.getByLabelText('Entrenamiento — Cliente 1:1'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);

    await waitFor(() =>
      expect(rolesClient.saveMatrixColumn).toHaveBeenCalledWith('coaching_1_1', {
        personal_info: true,
        personal_info_mentoring: false,
        training: false,
      })
    );
  });

  it('asks for confirmation before saving both variantes of Información Personal checked on the same column, and aborts if cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminRolesPage />);
    await screen.findByText('Entrenamiento');

    // Mentoring ya tiene personal_info_mentoring en true — marcar también
    // personal_info dispara el conflicto.
    fireEvent.click(screen.getByLabelText('Información personal — Premium'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[1]);

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(rolesClient.saveMatrixColumn).not.toHaveBeenCalled();
  });

  it('saves both variants of Información Personal marked true when the admin confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(rolesClient.saveMatrixColumn).mockResolvedValue(undefined);
    render(<AdminRolesPage />);
    await screen.findByText('Entrenamiento');

    fireEvent.click(screen.getByLabelText('Información personal — Premium'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[1]);

    await waitFor(() =>
      expect(rolesClient.saveMatrixColumn).toHaveBeenCalledWith('mentoring', {
        personal_info: true,
        personal_info_mentoring: true,
        training: true,
      })
    );
  });
});

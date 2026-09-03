'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { listSupplements, createSupplement, deleteSupplement, type Supplement } from '../../lib/supplements-client';

export function AdminSupplementsPanel({ clientId }: { clientId: string }) {
  const { data: supplements = [] as Supplement[], isLoading, mutate } = useSWR(
    ['supplements', clientId],
    () => listSupplements(clientId),
  );
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createSupplement(clientId, { name: name.trim(), dose: dose || undefined, category: category || undefined });
      setName('');
      setDose('');
      setCategory('');
      await mutate();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(suppId: string) {
    try {
      await deleteSupplement(clientId, suppId);
      await mutate();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (isLoading) return <p>Cargando suplementos...</p>;

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="supplement-name">Nombre del suplemento</label>
      <input id="supplement-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="supplement-dose">Dosis</label>
      <input id="supplement-dose" value={dose} onChange={(e) => setDose(e.target.value)} />
      <label htmlFor="supplement-category">Categoría</label>
      <select id="supplement-category" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Sin categoría</option>
        <option value="Nootrópico">Nootrópico</option>
        <option value="Adaptógeno">Adaptógeno</option>
        <option value="Sueño">Sueño</option>
        <option value="Rendimiento">Rendimiento</option>
        <option value="Base">Base</option>
      </select>
      <button type="button" onClick={handleCreate}>
        Asignar suplemento
      </button>

      {supplements.length === 0 ? (
        <p>Sin suplementos asignados.</p>
      ) : (
        <ul>
          {supplements.map((supplement) => (
            <li key={supplement.id}>
              <strong>{supplement.name}</strong> {supplement.dose ? `— ${supplement.dose}` : ''}
              <button type="button" onClick={() => handleDelete(supplement.id)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { listRecipes, uploadRecipe, deleteRecipe, type Recipe } from '../../lib/recipes-client';
import { showToast } from '../layout/AppShell';
import EmptyState from '../ui/EmptyState';
import FileField from '../ui/FileField';
import { IconFileDownload } from '../ui/icons';

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 400, color: 'var(--eph-muted)', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, borderRadius: 0, border: '1px solid var(--eph-line-2)',
  padding: '0 10px', fontSize: 15, fontWeight: 400, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box',
};
const dangerButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 0, border: '1px solid var(--eph-danger)',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'transparent', color: 'var(--eph-danger)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', flexShrink: 0,
};
const primaryButtonStyle: React.CSSProperties = {
  height: 36, padding: '0 18px', borderRadius: 0, border: 'none',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
};

export function AdminRecipesPanel() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function refetch() {
    setRecipes(await listRecipes());
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload() {
    if (!name.trim() || !file) return;
    setUploading(true);
    try {
      await uploadRecipe(name.trim(), category.trim() || null, file);
      setName('');
      setCategory('');
      setFile(null);
      await refetch();
      showToast('Receta subida.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(recipeId: string) {
    try {
      await deleteRecipe(recipeId);
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  if (loading) return <p style={{ color: 'var(--eph-muted)', fontSize: 14 }}>Cargando recetas…</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="arp-name">Nombre de la receta</label>
          <input id="arp-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Bowl de proteína" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="arp-category">Categoría (opcional)</label>
          <input id="arp-category" style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Desayuno" />
        </div>
      </div>
      <FileField
        id="arp-pdf"
        label="Archivo PDF"
        accept="application/pdf"
        uploading={uploading}
        fileName={file?.name}
        onFileChange={setFile}
      />
      <button type="button" style={{ ...primaryButtonStyle, marginTop: 10 }} onClick={handleUpload} disabled={uploading || !name.trim() || !file}>
        Subir receta
      </button>

      <div style={{ marginTop: 16 }}>
        {recipes.length === 0 ? (
          <EmptyState message="Aún no hay recetas cargadas." />
        ) : (
          recipes.map((recipe) => (
            <div
              key={recipe.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '0.5px solid var(--eph-line)' }}
            >
              <span aria-hidden style={{ color: 'var(--eph-accent)', flexShrink: 0, display: 'inline-flex' }}>
                <IconFileDownload size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--eph-text)' }}>{recipe.name}</p>
                {recipe.category && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--eph-muted)' }}>{recipe.category}</p>}
              </div>
              <button type="button" style={dangerButtonStyle} onClick={() => handleDelete(recipe.id)}>Eliminar</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

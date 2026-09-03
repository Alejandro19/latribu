import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type Recipe = { id: string; name: string; category: string | null; pdfUrl: string; pdfName: string; active: boolean };

export async function listRecipes(): Promise<Recipe[]> {
  const body = await authorizedRequest<{ success: boolean; recipes: Recipe[]; error?: string }>('/api/admin/recipes', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las recetas.');
  return body.recipes;
}

export async function uploadRecipe(name: string, category: string | null, file: File): Promise<Recipe> {
  const formData = new FormData();
  formData.append('name', name);
  if (category) formData.append('category', category);
  formData.append('pdf', file);
  const body = await authorizedRequest<{ success: boolean; recipe: Recipe; error?: string }>('/api/admin/recipes', 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir la receta.');
  return body.recipe;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/recipes/${recipeId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la receta.');
}

export async function listActiveRecipes(clientId: string): Promise<Recipe[]> {
  const body = await authorizedRequest<{ success: boolean; recipes: Recipe[]; error?: string }>(`/api/clients/${clientId}/recipes`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las recetas.');
  return body.recipes;
}

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

export type MenuMealOption = {
  label: string;
  items: string[];
};

export type MenuMeal = {
  name: string;
  options: MenuMealOption[];
};

export type NutritionPlan = {
  id?: string;
  dailyCals?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  notes?: string | null;
  summary?: string | null;
  menuPlan?: MenuMeal[] | null;
  recommendations?: string[] | null;
  closingMessage?: string | null;
  pdfUrl?: string | null;
  pdfName?: string | null;
};

export type Meal = {
  id: string;
  mealTime: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export async function getNutrition(clientId: string): Promise<{ plan: NutritionPlan; meals: Meal[] }> {
  const body = await authorizedRequest<{ success: boolean; plan: NutritionPlan; meals: Meal[]; error?: string }>(`/api/clients/${clientId}/nutrition`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el plan de nutrición.');
  return { plan: body.plan, meals: body.meals };
}

export async function saveNutritionPlan(
  clientId: string,
  patch: Partial<NutritionPlan> & {
    daily_cals?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    menu_plan?: MenuMeal[];
    recommendations?: string[];
    closing_message?: string | null;
  }
): Promise<NutritionPlan> {
  const body = await authorizedRequest<{ success: boolean; plan: NutritionPlan; error?: string }>(`/api/clients/${clientId}/nutrition`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al guardar el plan.');
  return body.plan;
}

export async function uploadNutritionPdf(clientId: string, file: File): Promise<NutritionPlan> {
  const formData = new FormData();
  formData.append('pdf', file);
  const body = await authorizedRequest<{ success: boolean; plan: NutritionPlan; error?: string }>(`/api/clients/${clientId}/nutrition/upload-pdf`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir el PDF.');
  return body.plan;
}

export async function createMeal(clientId: string, input: { meal_time: string; name: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }): Promise<Meal> {
  const body = await authorizedRequest<{ success: boolean; meal: Meal; error?: string }>(`/api/clients/${clientId}/meals`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la comida.');
  return body.meal;
}

export async function updateMeal(clientId: string, mealId: string, input: { meal_time: string; name: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }): Promise<Meal> {
  const body = await authorizedRequest<{ success: boolean; meal: Meal; error?: string }>(`/api/clients/${clientId}/meals/${mealId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la comida.');
  return body.meal;
}

export async function deleteMeal(clientId: string, mealId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/meals/${mealId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la comida.');
}

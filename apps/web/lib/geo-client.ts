const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

export type CountryOption = { isoCode: string; name: string; flag: string; phonecode: string };
export type CountriesResponse = { priority: CountryOption[]; rest: CountryOption[] };

export async function getCountries(): Promise<CountriesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/countries`);
  const body = await res.json();
  if (!body.success) throw new Error('Error al obtener países.');
  return body.data;
}

export async function getCities(isoCode: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/api/cities/${isoCode}`);
  const body = await res.json();
  if (!body.success) throw new Error('Error al obtener ciudades.');
  return body.data;
}

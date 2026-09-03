import { Country, City } from 'country-state-city';

const PRIORITY_ISO = ['CO', 'MX', 'ES', 'AR', 'CL', 'PE', 'VE', 'EC', 'US', 'BO', 'PY', 'UY', 'CR', 'GT', 'HN', 'SV', 'NI', 'PA', 'CU', 'DO'];

export type CountryOption = { isoCode: string; name: string; flag: string; phonecode: string };
export type CountriesResponse = { priority: CountryOption[]; rest: CountryOption[] };

let cache: CountriesResponse | null = null;

export function getCountries(): CountriesResponse {
  if (cache) return cache;
  let displayNames: Intl.DisplayNames | undefined;
  try {
    displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    displayNames = undefined;
  }
  const all = Country.getAllCountries()
    .map((c) => {
      let name = c.name;
      try {
        if (displayNames) name = displayNames.of(c.isoCode) || c.name;
      } catch {
        // se conserva el nombre en inglés si Intl.DisplayNames falla para ese código
      }
      return { isoCode: c.isoCode, name, flag: c.flag || '', phonecode: c.phonecode || '' };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  cache = {
    priority: PRIORITY_ISO.map((code) => all.find((c) => c.isoCode === code)).filter((c): c is CountryOption => Boolean(c)),
    rest: all.filter((c) => !PRIORITY_ISO.includes(c.isoCode)),
  };
  return cache;
}

export function getCitiesOfCountry(isoCode: string): string[] {
  const cities = City.getCitiesOfCountry(isoCode.toUpperCase()) || [];
  return [...new Set(cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'es'));
}

'use client';

import { useEffect, useState } from 'react';
import { getCountries, getCities, type CountryOption } from '../../lib/geo-client';
import SelectField from '../ui/SelectField';
import FloatingField from '../ui/FloatingField';

export type CountryCityValue = {
  country: string;
  city: string;
  phoneCode: string;
  phoneNumber: string;
};

export type CountryCityPickerProps = {
  value: CountryCityValue;
  onChange: (patch: Partial<CountryCityValue>) => void;
  invalidFieldIds?: Set<string>;
};

export function CountryCityPicker({ value, onChange, invalidFieldIds }: CountryCityPickerProps) {
  const [priority, setPriority] = useState<CountryOption[]>([]);
  const [rest, setRest] = useState<CountryOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCountries()
      .then((data) => {
        setPriority(data.priority);
        setRest(data.rest);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const allCountries = [...priority, ...rest];
  const phoneCodes = Array.from(new Map(allCountries.filter((c) => c.phonecode).map((c) => [c.phonecode, c])).values());

  const handleCountryChange = (isoCode: string) => {
    onChange({ country: isoCode, city: '' });
    if (isoCode) {
      getCities(isoCode).then(setCities).catch((e: Error) => setLoadError(e.message));
    } else {
      setCities([]);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {loadError && <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-2">{loadError}</p>}

      <div>
        <SelectField
          label="País de residencia"
          placeholder="Selecciona tu país…"
          value={value.country}
          onChange={handleCountryChange}
          options={[...priority, ...rest].map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))}
        />
        {invalidFieldIds?.has('country') && (
          <p role="alert" className="mt-1.5 text-xs text-[var(--danger)]">Este campo es obligatorio.</p>
        )}
      </div>

      <div>
        <FloatingField
          id="field-city"
          label="Ciudad"
          list="field-city-options"
          disabled={!value.country}
          value={value.city}
          onChange={(v) => onChange({ city: v })}
        />
        <datalist id="field-city-options">
          {cities.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
        {invalidFieldIds?.has('city') && (
          <p role="alert" className="mt-1.5 text-xs text-[var(--danger)]">Este campo es obligatorio.</p>
        )}
      </div>

      <div className="sm:col-span-2">
        <div className="flex gap-2">
          <div className="w-[128px] flex-shrink-0">
            <SelectField
              label="Indicativo"
              value={value.phoneCode}
              onChange={(v) => onChange({ phoneCode: v })}
              options={phoneCodes.map((c) => ({ value: `+${c.phonecode}`, label: `${c.flag} +${c.phonecode}` }))}
            />
          </div>
          <div className="flex-1">
            <FloatingField
              id="field-phone-number"
              label="Celular (WhatsApp)"
              type="tel"
              value={value.phoneNumber}
              onChange={(v) => onChange({ phoneNumber: v })}
            />
          </div>
        </div>
        {invalidFieldIds?.has('phone_number') && (
          <p role="alert" className="mt-1.5 text-xs text-[var(--danger)]">Este campo es obligatorio.</p>
        )}
      </div>
    </div>
  );
}

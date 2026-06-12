import countriesData from "./countries.json";

export type Country = {
  id: number;
  name: string;
  isoAlpha2: string;
  isoAlpha3: string;
  isoNumeric: number;
  currency: {
    code: string;
    name: string;
    symbol: string | false;
  };
  flag: string;
  timezone: string;
  phoneCode: string;
};

export const COUNTRIES: Country[] = countriesData as Country[];

export function countryFlagSrc(flag: string) {
  return `data:image/png;base64,${flag}`;
}

export function findCountryByName(name: string): Country | undefined {
  return COUNTRIES.find((country) => country.name === name);
}

export function searchCountries(query: string, limit = 80): Country[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return COUNTRIES.slice(0, limit);

  return COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(normalized) ||
      country.isoAlpha2.toLowerCase().includes(normalized) ||
      country.isoAlpha3.toLowerCase().includes(normalized) ||
      country.phoneCode.includes(normalized.replace(/^\+/, "")),
  ).slice(0, limit);
}

export const COUNTRY_NAMES = COUNTRIES.map((country) => country.name);

const PHONE_CODE_SORTED = [...COUNTRIES].sort(
  (a, b) => b.phoneCode.length - a.phoneCode.length,
);

export function parsePhoneValue(value: string): { country?: Country; nationalNumber: string } {
  const trimmed = value.trim();
  if (!trimmed) return { nationalNumber: "" };

  const normalized = trimmed.startsWith("+")
    ? trimmed
    : `+${trimmed.replace(/[^\d+]/g, "")}`;

  for (const country of PHONE_CODE_SORTED) {
    if (normalized.startsWith(country.phoneCode)) {
      const nationalNumber = normalized.slice(country.phoneCode.length).trim();
      return { country, nationalNumber };
    }
  }

  return { nationalNumber: trimmed.replace(/^\+/, "") };
}

export function buildPhoneValue(country: Country | undefined, nationalNumber: string): string {
  const digits = nationalNumber.trim();
  if (!digits) return "";
  if (!country?.phoneCode) return digits;
  return `${country.phoneCode} ${digits}`;
}

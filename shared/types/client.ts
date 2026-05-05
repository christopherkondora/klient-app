/**
 * Ügyfél domain típus — a renderer és az electron stores egyaránt innen használja.
 * A mezőnevek megegyeznek az SQLite `clients` tábla oszlopaival, de a típusok
 * a domain szerinti pontosítást viszik (pl. `country_code: string` ISO-2 alak).
 */
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  postal_code: string;
  city: string;
  street: string;
  address_line2: string;
  tax_number: string;
  representative_name: string;
  /** ISO 3166-1 alpha-2 (pl. 'HU', 'DE'). Default 'HU'. */
  country_code: string;
  /** EU ÁFA-szám (pl. 'DE123456789'). Csak EU országoknál releváns. */
  eu_vat_number: string;
  /** ISO 4217 (pl. 'HUF', 'EUR'). Default 'HUF'. */
  preferred_currency: string;
  /** Számla nyelve: 'hu' | 'en' | 'de' a tipikus érték. Default 'hu'. */
  invoice_language: string;
  notes: string;
  color: string;
  created_at: string;
  updated_at: string;
}

/**
 * Új ügyfél létrehozásához vagy frissítéshez használt input. Az `id`, `created_at`,
 * `updated_at` mezőket a store kezeli, a többi opcionális — ami nincs megadva,
 * az alapértelmezett értéket kap (üres string vagy 'HU' / 'HUF' / 'hu' / '#6366f1').
 */
export type ClientInput = Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>;

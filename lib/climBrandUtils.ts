/** URL slug for a clim brand key (no JSON dependency — safe for client components). */
export function climBrandSlug(brand: string): string {
  return brand.toLowerCase().trim().replace(/\s+/g, "-");
}

export function climBrandHref(brand: string): string {
  return `/climatiseurs-stock/marque/${climBrandSlug(brand)}`;
}

// Aides partagées des devis / factures du gérant.

export type DocItem = { label: string; qty: number; unit: string; unitPrice: number };

export function parisToday(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Lignes de prestations valides (max 50). */
export function cleanItems(v: unknown): DocItem[] {
  return (Array.isArray(v) ? v : [])
    .slice(0, 50)
    .map((it) => ({
      label: String((it as Record<string, unknown>)?.label ?? "").slice(0, 300),
      qty: Math.max(0, Number((it as Record<string, unknown>)?.qty) || 0),
      unit: String((it as Record<string, unknown>)?.unit ?? "").slice(0, 30),
      unitPrice: Math.max(0, Number((it as Record<string, unknown>)?.unitPrice) || 0),
    }))
    .filter((it) => it.label || it.qty || it.unitPrice);
}

export function itemsOf(json: string): DocItem[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function totalHt(items: DocItem[]): number {
  return items.reduce((acc, it) => acc + (it.qty || 0) * (it.unitPrice || 0), 0);
}

export const euros = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

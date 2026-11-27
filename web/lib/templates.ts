"use client";

// Reusable invoice templates. Built-in ones cover common freelance services so
// users can start from a sensible description instead of typing from scratch.
// Custom templates the user saves are persisted in localStorage.

import { parseAmount } from "./format";

export type InvoiceTemplate = {
  id: string;
  name: string;
  description: string;
  amount: string;
};

const STORAGE_KEY = "payloop.templates.custom";

export const BUILTIN_TEMPLATES: InvoiceTemplate[] = [
  { id: "website-design", name: "Website design", description: "Brand website design and development", amount: "1200" },
  { id: "mobile-app", name: "Mobile app development", description: "Mobile app development", amount: "2500" },
  { id: "logo-design", name: "Logo design", description: "Logo design and brand kit", amount: "350" },
  { id: "content-writing", name: "Content writing", description: "Blog content writing", amount: "500" },
  { id: "social-pack", name: "Social media pack", description: "Social media graphics and captions", amount: "400" },
  { id: "web-maintenance", name: "Web maintenance", description: "Monthly website maintenance", amount: "300" },
  { id: "consulting", name: "Consulting", description: "Consulting session", amount: "150" },
];

export function loadCustomTemplates(): InvoiceTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is InvoiceTemplate =>
        Boolean(t && typeof t.id === "string" && typeof t.name === "string" && typeof t.description === "string" && typeof t.amount === "string")
    );
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: InvoiceTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage may be unavailable (private mode); templates simply won't persist.
  }
}

/**
 * Saves a custom template. The amount is validated with parseAmount; an empty
 * amount is allowed (stored as ""), but a non-empty invalid amount is rejected
 * so that templates never carry values that would crash the Create page.
 */
export function saveCustomTemplate(
  name: string,
  description: string,
  amount: string
): { ok: true; templates: InvoiceTemplate[] } | { ok: false; error: string } {
  const trimmedAmount = amount.trim();
  if (trimmedAmount !== "") {
    const parsed = parseAmount(trimmedAmount);
    if (!parsed.ok) return { ok: false, error: parsed.error };
  }
  const templates = loadCustomTemplates();
  const next = [
    ...templates,
    { id: `custom-${Date.now()}`, name: name.trim(), description: description.trim(), amount: trimmedAmount },
  ];
  saveCustomTemplates(next);
  return { ok: true, templates: next };
}

export function deleteCustomTemplate(id: string): InvoiceTemplate[] {
  const next = loadCustomTemplates().filter((t) => t.id !== id);
  saveCustomTemplates(next);
  return next;
}

const YEAR = /^\d{4}$/;
const MONTH = /^(0[1-9]|1[0-2])$/;
/** "Sans date", and the same in English. */
const UNDATED = new Set(['sans date', 'undated']);

/**
 * Technical folders are never albums: years (2026), months directly
 * under a year (2026/10) and "Sans date" ("Undated"). Their files belong to the nearest
 * non-technical parent folder.
 */
export function isTechnicalFolderName(name: string, parentName: string | null): boolean {
  if (UNDATED.has(name.trim().toLowerCase())) return true;
  if (YEAR.test(name)) return true;
  return MONTH.test(name) && parentName !== null && YEAR.test(parentName);
}

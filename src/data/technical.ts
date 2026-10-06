const YEAR = /^\d{4}$/;
const MONTH = /^(0[1-9]|1[0-2])$/;
const UNDATED = 'sans date';

/**
 * Technical folders are never albums: years (2026), months directly
 * under a year (2026/10) and "Sans date". Their files belong to the nearest
 * non-technical parent folder.
 */
export function isTechnicalFolderName(name: string, parentName: string | null): boolean {
  if (name.trim().toLowerCase() === UNDATED) return true;
  if (YEAR.test(name)) return true;
  return MONTH.test(name) && parentName !== null && YEAR.test(parentName);
}

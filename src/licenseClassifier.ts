/**
 * Pure logic -- no `vscode` dependency. New niche (not a port from
 * the Kotlin catalog). Evidence: no VS Code extension found that
 * shows per-dependency SPDX license as live diagnostics -- the real
 * tooling for this is 100% CLI (`license-checker-rseidelsohn`,
 * `spdx-expression-parse`), confirmed absent from the editor across
 * 2 independent searches.
 */

export type LicenseCategory = 'permissive' | 'weak-copyleft' | 'strong-copyleft' | 'unknown';

const PERMISSIVE = new Set([
  'mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'bsd-3-clause-clear', 'isc',
  '0bsd', 'unlicense', 'cc0-1.0', 'python-2.0', 'zlib', 'wtfpl', 'artistic-2.0', 'blueoak-1.0.0',
]);
const WEAK_COPYLEFT = new Set(['lgpl-2.0', 'lgpl-2.1', 'lgpl-3.0', 'mpl-1.1', 'mpl-2.0', 'epl-1.0', 'epl-2.0', 'cddl-1.0', 'cddl-1.1']);
const STRONG_COPYLEFT = new Set(['gpl-1.0', 'gpl-2.0', 'gpl-3.0', 'agpl-1.0', 'agpl-3.0', 'sspl-1.0']);

/** Strips SPDX `-only`/`-or-later` suffixes and a trailing `+` (both
 * mean "this version or later/only" -- the base license family is
 * what matters for the permissive/copyleft classification here). */
function normalizeSpdxId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/\+$/, '')
    .replace(/-(only|or-later)$/, '');
}

export function classifyLicense(spdxId: string): LicenseCategory {
  const normalized = normalizeSpdxId(spdxId);
  if (PERMISSIVE.has(normalized)) return 'permissive';
  if (WEAK_COPYLEFT.has(normalized)) return 'weak-copyleft';
  if (STRONG_COPYLEFT.has(normalized)) return 'strong-copyleft';
  return 'unknown';
}

/** A package.json's own "license" field takes 3 real shapes seen in
 * the wild: a plain SPDX string (modern, npm-recommended), an object
 * `{ type, url }` (older convention), or an array of those objects
 * (very old packages with multiple applicable licenses -- deprecated
 * by npm but still present in some published packages). Returns every
 * SPDX id found; an SPDX expression like "(MIT OR Apache-2.0)" is
 * split on OR/AND into its component ids rather than parsed as a real
 * boolean expression (v0.1 scope -- a real SPDX expression parser is
 * a bigger dependency-free undertaking than this warrants). */
export function parseLicenseField(packageJson: unknown): string[] {
  if (typeof packageJson !== 'object' || packageJson === null) return [];
  const license = (packageJson as Record<string, unknown>).license;
  if (typeof license === 'string') return splitExpression(license);
  if (isLicenseObject(license)) return license.type ? [license.type] : [];

  const licenses = (packageJson as Record<string, unknown>).licenses;
  if (Array.isArray(licenses)) {
    return licenses.filter(isLicenseObject).flatMap((entry) => (entry.type ? [entry.type] : []));
  }
  return [];
}

function isLicenseObject(value: unknown): value is { type?: string } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function splitExpression(expression: string): string[] {
  return expression
    .replace(/[()]/g, ' ')
    .split(/\s+(?:OR|AND)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export interface DependencyLicenseResult {
  name: string;
  licenses: string[];
  category: LicenseCategory;
}

/** A dependency's overall category is its LEAST permissive license
 * among an SPDX-OR expression's options (a real "(MIT OR GPL-3.0)"
 * dual-license still lets you legally choose MIT -- but flagging the
 * more restrictive option is the safer default for an automated
 * check, and it's stated as such rather than silently picking the
 * favorable reading). */
export function classifyDependency(name: string, packageJson: unknown): DependencyLicenseResult {
  const licenses = parseLicenseField(packageJson);
  if (licenses.length === 0) return { name, licenses, category: 'unknown' };

  const categories = licenses.map(classifyLicense);
  const severity: LicenseCategory[] = ['strong-copyleft', 'weak-copyleft', 'unknown', 'permissive'];
  const worst = severity.find((c) => categories.includes(c)) ?? 'unknown';
  return { name, licenses, category: worst };
}

// Generic, dependency-free object helpers shared across client and server.
// Kept here (not in stateOps) so modules that only need these utilities don't
// couple to the heavier state-sanitization code.

/** Narrow to a plain (non-array, non-null) object. */
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Recursively merge `patch` into `target` in place: plain objects merge, arrays
 *  and primitives (including null) replace. Returns `target`. */
export function deepMerge(
	target: Record<string, unknown>,
	patch: Record<string, unknown>,
): Record<string, unknown> {
	for (const [k, v] of Object.entries(patch)) {
		if (isPlainObject(v) && isPlainObject(target[k])) {
			deepMerge(target[k] as Record<string, unknown>, v);
		} else {
			target[k] = v;
		}
	}
	return target;
}

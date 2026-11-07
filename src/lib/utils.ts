import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The names `app.css` adds to Tailwind's spacing scale (#114), told to
 * tailwind-merge. It drops a class only when it knows a later one conflicts, so
 * unconfigured it kept `gap-sections` beside a caller's `gap-6` and the
 * stylesheet's order picked the winner — which moved five screens. `cn` and the
 * `ui/variants.ts` recipes both merge with this, so a caller's override beats a
 * token everywhere. A new spacing token goes here as well as in `app.css`.
 */
export const twMergeConfig = {
	extend: { theme: { spacing: ['sections', 'group', 'row', 'inset', 'gutter'] } },
};

const twMerge = extendTailwindMerge(twMergeConfig);

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Round to one decimal place — the app's display precision for kg and scores. */
export function round(n: number): number {
	return Math.round(n * 10) / 10;
}

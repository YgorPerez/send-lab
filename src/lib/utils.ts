import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Round to one decimal place — the app's display precision for kg and scores. */
export function round(n: number): number {
	return Math.round(n * 10) / 10;
}

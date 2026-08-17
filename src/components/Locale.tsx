// Locale switching, on the phone.
//
// The brief requires a locale control the athlete can reach *on the device*,
// because pt-BR is where every direction breaks first and a desktop-only toggle
// hides that. Paraglide's own `setLocale()` reloads the page by default; a reload
// throws away the half-answered readiness check and the half-typed set, which is
// exactly the state worth looking at in the other language. So the switch is
// `{ reload: false }` plus a remount: `getLocale()` reads localStorage on every
// call and is not cached, so re-rendering the tree is enough to re-resolve every
// `m.*()` and every `getContent()` lookup.
import { createContext, use } from 'react';
import * as m from '$lib/paraglide/messages';
import type { Locale } from '$lib/paraglide/runtime';
import { locales } from '$lib/paraglide/runtime';

interface LocaleControl {
	locale: Locale;
	setLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleControl>({
	locale: 'en-US',
	setLocale: () => {},
});

/** Short label for a locale — the toggle has room for two letters, not two words. */
const SHORT: Record<string, string> = { 'en-US': 'EN', 'pt-BR': 'PT' };

/**
 * The locale control, as a pair of words rather than a select.
 *
 * Two options do not need a menu, and a menu here would be the tenth item on a
 * screen whose whole argument is that there should be one.
 */
export function LocaleToggle() {
	const { locale, setLocale } = use(LocaleContext);
	return (
		<div className="flex items-baseline gap-2">
			{locales.map((l) => (
				<button
					key={l}
					type="button"
					aria-label={`${m.lang_label()}: ${l === 'pt-BR' ? m.lang_pt() : m.lang_en()}`}
					aria-current={l === locale ? 'true' : undefined}
					onClick={() => setLocale(l)}
					className={
						l === locale
							? 'c-eyebrow border-flag border-b text-flag'
							: 'c-eyebrow border-transparent border-b'
					}
				>
					{SHORT[l] ?? l}
				</button>
			))}
		</div>
	);
}

// How Paraglide decides which locale to render — declared once, because it is
// compiled into the generated runtime and there are two compilers.
//
// `vite.config.ts` compiles for dev and build; `scripts/compile-messages.ts`
// compiles inside `pnpm check`, and therefore inside `pnpm verify`. When only
// the Vite side passed a strategy, every `verify` quietly rewrote
// `src/lib/paraglide/runtime.js` with the compiler's own default
// (`cookie` / `globalVariable` / `baseLocale`). A production build was always
// correct — Vite regenerates it — but a dev server started after a gate run
// served a runtime that ignored the athlete's stored locale, and nothing went
// red. The generated output is gitignored, so it could not show up in a diff
// either.
//
// The order itself is ADR 0006's. Client-only SPA: persist the athlete's
// choice, fall back to the browser language, then the base locale. **Locale
// never enters the URL** — a precached shell must stay user-independent, and a
// locale-prefixed route yields either two shells or a redirect on every cold
// start.
export const PARAGLIDE_STRATEGY = ['localStorage', 'preferredLanguage', 'baseLocale'] as const;

/** Where the `localStorage` strategy above persists the athlete's choice.
 *
 *  Paraglide's own key, named here because two gate modules write it from
 *  outside the app: `scripts/browser.ts` sets the locale a screen is measured
 *  in, and `scripts/seeded-record.ts` reads it back *inside* the page to decide
 *  which locale's training record to install. It belongs beside the strategy
 *  that decides storage is where the choice lives — if that order ever drops
 *  `localStorage`, this is the line that stops making sense. */
export const LOCALE_KEY = 'PARAGLIDE_LOCALE';

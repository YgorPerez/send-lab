import enUS from './en-US';
import { exerciseParams } from './exercises';
import ptBR from './pt-BR';
import type { Content, Exercise, LocaleContent } from './types';

const LOCALES: Record<string, LocaleContent> = {
	'en-US': enUS,
	'pt-BR': ptBR,
};

/** Merge language-neutral params with localized prose, matched by id + index. */
function merge(locale: LocaleContent): Content {
	const exercises: Record<string, Exercise> = {};
	for (const [id, prose] of Object.entries(locale.exercises)) {
		const params = exerciseParams[id];
		exercises[id] = {
			name: prose.name,
			cat: prose.cat,
			catVar: params?.catVar ?? '--ink-faint',
			variants: prose.variants.map((p, i) => ({ ...(params?.variants[i] ?? {}), ...p })),
		};
	}
	return { ...locale, exercises };
}

const CONTENT: Record<string, Content> = {
	'en-US': merge(LOCALES['en-US']),
	'pt-BR': merge(LOCALES['pt-BR']),
};

/**
 * The training library, in one locale.
 *
 * **The locale is an argument.** It used to be read off `getLocale()` in here,
 * which made every consumer of the library implicitly locale-aware and made a
 * pure function of the content impossible to write — the store's seed, the three
 * screen resolvers and `tests/` all need to say which language they mean.
 * #56 made it explicit while there were two call sites; the SvelteKit app had 43,
 * and every page built after this one would have added more.
 *
 * `string` rather than a closed union, so an unrecognised tag falls back to the
 * base locale rather than failing to compile: what reaches here is whatever
 * Paraglide resolved, and the fallback is the honest handling of a tag the
 * library has no prose for.
 *
 * Athlete-authored exercises used to be merged in here; `customExercises` was
 * dropped by the rebuild's keep/drop audit (#12), so the library is now the
 * built-in content alone.
 */
export function getContent(locale: string): Content {
	return CONTENT[locale] ?? CONTENT['en-US'];
}

export {
	type Answers,
	computeReadiness,
	hasWellnessAnswer,
	phaseId,
	type SelfCheckBand,
	scoreSelfCheck,
	visibleQuestions,
	visibleQuestionsOrdered,
} from './logic';
export type { BodyArea } from './types';

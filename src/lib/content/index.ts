import { getLocale } from '$lib/paraglide/runtime';
import { appState } from '$lib/state.svelte';
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

/** The training content for the active Paraglide locale, with the user's custom
 *  exercises merged in (they extend, or override by id, the built-in library). */
export function getContent(): Content {
	const base = CONTENT[getLocale()] ?? CONTENT['en-US'];
	const custom = appState.customExercises;
	if (!custom || Object.keys(custom).length === 0) return base;
	return { ...base, exercises: { ...base.exercises, ...custom } };
}

export {
	type Answers,
	computeReadiness,
	type DailyFlag,
	type DeepBand,
	type DeepResult,
	type FlagArea,
	phaseId,
	scoreDeep,
	visibleQuestions,
	visibleQuestionsOrdered,
} from './logic';
export type { Day, MetricId } from './types';

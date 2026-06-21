import { getLocale } from '$lib/paraglide/runtime';
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

/** The training content for the active Paraglide locale. */
export function getContent(): Content {
	return CONTENT[getLocale()] ?? CONTENT['en-US'];
}

export { type Answers, computeVerdictId, phaseId } from './logic';
export type { Day, MetricId } from './types';

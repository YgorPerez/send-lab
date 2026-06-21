import { getLocale } from '$lib/paraglide/runtime';
import enUS from './en-US';
import ptBR from './pt-BR';
import type { Content } from './types';

const CONTENT: Record<string, Content> = {
	'en-US': enUS,
	'pt-BR': ptBR,
};

/** The training content for the active Paraglide locale. */
export function getContent(): Content {
	return CONTENT[getLocale()] ?? enUS;
}

export { type Answers, computeVerdictId, phaseId } from './logic';
export type { Day, MetricId } from './types';

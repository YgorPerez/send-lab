// The athlete-typed text in the seeded scenario.
//
// Everything else on the screens is app copy (`messages/`) or training content
// (`src/lib/content/`), both of which are already bilingual and already guarded.
// What is left is the handful of strings a person typed — session notes — which
// have no home in either store and would otherwise be English-only in an app that
// is used in pt-BR, where the layout breaks first.
//
// A note is free text, so once written it stays in the language it was written
// in; that is what ADR 0012 distinguishes a stored *label* from. This module is
// the scenario's stand-in for the athlete having typed them.
//
// Kept in its own module, with **no imports**, so `scripts/check-locale-parity.ts`
// can read it under plain `tsx` without resolving the app's Vite aliases.
export const SEED_PROSE: Record<string, Record<string, string>> = {
	'en-US': {
		note_strong: 'Felt strong on the last two sets — added 2.5kg and it still moved well.',
		note_skin: 'Skin was thin by the third round. Cut it there rather than push through.',
		note_short: 'Short session, in and out. Kept everything at the low end of the range.',
		note_elbow: 'Right elbow grumbled on the pulls. Dropped the added load and it settled.',
		activity_note_deload: 'Last week of the block — everything at reduced load.',
		activity_note_check: 'Finger self-check, worth repeating in a fortnight.',
	},
	'pt-BR': {
		note_strong: 'Me senti forte nas duas últimas séries — coloquei 2,5kg e ainda subiu bem.',
		note_skin: 'A pele estava fina já na terceira rodada. Parei ali em vez de insistir.',
		note_short: 'Sessão curta, entrei e saí. Mantive tudo no limite inferior da faixa.',
		note_elbow: 'O cotovelo direito reclamou nas puxadas. Tirei a carga extra e acalmou.',
		activity_note_deload: 'Última semana do bloco — tudo com carga reduzida.',
		activity_note_check: 'Autoavaliação dos dedos, vale repetir daqui a duas semanas.',
	},
};

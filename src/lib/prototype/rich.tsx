// The training content emphasises with inline `<b>` — verdict text, flag advice,
// the phase banner, the readiness lede. The SvelteKit app rendered those with
// `{@html}`.
//
// This turns them into React nodes instead of reaching for
// `dangerouslySetInnerHTML`. Two reasons, and the second is the real one:
//
//   1. Biome's recommended React domain flags `dangerouslySetInnerHTML`, so it
//      would fail the gate.
//   2. `<b>` is the only markup the content uses, and parsing exactly that is a
//      dozen lines. Handing a whole HTML string to the DOM to recover one tag is
//      a much larger promise than the content actually needs.
//
// Anything that is not `<b>…</b>` is emitted as text, tags included — so a tag
// the content adds later shows up visibly rather than silently rendering as
// markup.
import type { ReactNode } from 'react';

const BOLD = /<b>(.*?)<\/b>/gs;

/** Localized copy with inline `<b>` emphasis, as React nodes. */
export function rich(text: string): ReactNode[] {
	const out: ReactNode[] = [];
	let cursor = 0;
	let n = 0;

	BOLD.lastIndex = 0;
	let match = BOLD.exec(text);
	while (match !== null) {
		if (match.index > cursor) out.push(text.slice(cursor, match.index));
		out.push(<b key={`b${n++}`}>{match[1]}</b>);
		cursor = match.index + match[0].length;
		match = BOLD.exec(text);
	}
	if (cursor < text.length) out.push(text.slice(cursor));
	return out;
}

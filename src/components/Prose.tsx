// Training copy carries inline `<b>` emphasis — 37 occurrences across the
// content module, in verdict advice, flag advice, exercise rationale and cues.
// Rendered as plain text it shows the tags to the athlete, which is how this was
// found: the verdict on `/` read "…<b>7/3 repeaters</b> for critical force".
//
// Tokenised rather than injected. The copy is the app's own and could be trusted
// to `dangerouslySetInnerHTML`, but the fixture also carries athlete-typed prose
// through the same components, and a component that renders one string as markup
// will eventually be handed the other.
import type { ReactNode } from 'react';

const BOLD = /<b>(.*?)<\/b>/g;

export function Prose({ children }: { children: string }) {
	const out: ReactNode[] = [];
	let last = 0;
	let key = 0;
	for (const match of children.matchAll(BOLD)) {
		const at = match.index;
		if (at > last) out.push(children.slice(last, at));
		out.push(
			<b key={`b${key++}`} className="font-semibold">
				{match[1]}
			</b>,
		);
		last = at + match[0].length;
	}
	if (last < children.length) out.push(children.slice(last));
	return <>{out}</>;
}

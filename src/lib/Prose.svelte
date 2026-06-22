<script lang="ts">
import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
import { getContent } from '$lib/content';
import { cn } from '$lib/utils';

interface Props {
	value: string;
}

let { value }: Props = $props();

const glossary = getContent().glossary;

// Match glossary terms, longest first, not flanked by alphanumerics (so "CF"
// matches the standalone acronym, never inside a word). Case-sensitive.
const escaped = Object.keys(glossary)
	.sort((a, b) => b.length - a.length)
	.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const termRe = escaped.length
	? new RegExp(`(?<![A-Za-z0-9])(${escaped.join('|')})(?![A-Za-z0-9])`, 'g')
	: null;

interface Token {
	text: string;
	bold: boolean;
	term: boolean;
}

const tokens = $derived.by<Token[]>(() => {
	// 1) split <b>…</b> into bold / plain runs (trusted static copy, no {@html})
	const runs: { text: string; bold: boolean }[] = [];
	const boldRe = /<b>(.*?)<\/b>/g;
	let last = 0;
	let m: RegExpExecArray | null = boldRe.exec(value);
	while (m !== null) {
		if (m.index > last) runs.push({ text: value.slice(last, m.index), bold: false });
		runs.push({ text: m[1], bold: true });
		last = m.index + m[0].length;
		m = boldRe.exec(value);
	}
	if (last < value.length) runs.push({ text: value.slice(last), bold: false });

	// 2) within each run, peel out glossary terms (odd indices = capture group)
	const out: Token[] = [];
	for (const run of runs) {
		if (!termRe) {
			out.push({ text: run.text, bold: run.bold, term: false });
			continue;
		}
		const parts = run.text.split(termRe);
		for (let i = 0; i < parts.length; i++) {
			if (parts[i] === '') continue;
			out.push({ text: parts[i], bold: run.bold, term: i % 2 === 1 && parts[i] in glossary });
		}
	}
	return out;
});
</script>

{#each tokens as tok, i (i)}
	{#if tok.term}
		<Popover>
			<PopoverTrigger>
				{#snippet child({ props })}
					<!-- Popover (not tooltip) so the definition opens on tap, not just hover —
					     bits-ui wires the click/aria via {...props}. -->
					<button
						{...props}
						type="button"
						class={cn(
							'cursor-help text-teal underline decoration-teal/50 decoration-dotted underline-offset-2 transition-colors hover:text-teal/80 hover:decoration-teal focus-visible:text-teal/80 focus-visible:outline-none',
							tok.bold && 'font-semibold'
						)}>{tok.text}</button
					>
				{/snippet}
			</PopoverTrigger>
			<PopoverContent class="max-w-xs text-sm text-pretty">{glossary[tok.text]}</PopoverContent>
		</Popover>
	{:else if tok.bold}<b>{tok.text}</b>{:else}{tok.text}{/if}
{/each}

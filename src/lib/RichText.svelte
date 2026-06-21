<script lang="ts">
// Renders trusted copy that may contain <b>…</b> emphasis WITHOUT {@html}.
// The string is split on <b> tags; emphasised runs become real <b> elements
// and everything else is interpolated as text (Svelte escapes it), so there
// is no HTML-injection surface — this is the safe replacement for {@html}.
interface Props {
	value: string;
}

let { value }: Props = $props();

interface Segment {
	text: string;
	bold: boolean;
}

const segments = $derived.by<Segment[]>(() => {
	const out: Segment[] = [];
	const re = /<b>(.*?)<\/b>/g;
	let last = 0;
	let m: RegExpExecArray | null = re.exec(value);
	while (m !== null) {
		if (m.index > last) out.push({ text: value.slice(last, m.index), bold: false });
		out.push({ text: m[1], bold: true });
		last = m.index + m[0].length;
		m = re.exec(value);
	}
	if (last < value.length) out.push({ text: value.slice(last), bold: false });
	return out;
});
</script>

{#each segments as seg, i (i)}{#if seg.bold}<b>{seg.text}</b>{:else}{seg.text}{/if}{/each}

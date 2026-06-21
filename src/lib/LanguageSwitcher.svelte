<script lang="ts">
import LanguagesIcon from '@lucide/svelte/icons/languages';
import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
import * as m from '$lib/paraglide/messages';
import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';

const labels: Record<string, () => string> = {
	'en-US': m.lang_en,
	'pt-BR': m.lang_pt,
};

// setLocale() triggers a full reload, so reading getLocale() once is fine.
const current = getLocale();

function change(value: string | undefined) {
	if (value && value !== current) setLocale(value as (typeof locales)[number]);
}
</script>

<Select type="single" value={current} onValueChange={change}>
	<SelectTrigger
		class="h-9 w-auto gap-2 border-line bg-panel font-mono text-xs text-ink-dim"
		aria-label={m.lang_label()}
	>
		<LanguagesIcon class="size-4" />
		{labels[current]?.() ?? current}
	</SelectTrigger>
	<SelectContent>
		{#each locales as locale (locale)}
			<SelectItem value={locale}>{labels[locale]?.() ?? locale}</SelectItem>
		{/each}
	</SelectContent>
</Select>

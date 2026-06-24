<script lang="ts">
import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
import { Card } from '$lib/components/ui/card';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
import { STUDIES } from '$lib/studies';

const PROSE: Record<string, { title: () => string; summary: () => string; applies: () => string }> =
	{
		baar: {
			title: m.study_baar_title,
			summary: m.study_baar_summary,
			applies: m.study_baar_applies,
		},
		lopez: {
			title: m.study_lopez_title,
			summary: m.study_lopez_summary,
			applies: m.study_lopez_applies,
		},
		horst: {
			title: m.study_horst_title,
			summary: m.study_horst_summary,
			applies: m.study_horst_applies,
		},
		lattice: {
			title: m.study_lattice_title,
			summary: m.study_lattice_summary,
			applies: m.study_lattice_applies,
		},
		nelson: {
			title: m.study_nelson_title,
			summary: m.study_nelson_summary,
			applies: m.study_nelson_applies,
		},
		ferrer: {
			title: m.study_ferrer_title,
			summary: m.study_ferrer_summary,
			applies: m.study_ferrer_applies,
		},
		hooper: {
			title: m.study_hooper_title,
			summary: m.study_hooper_summary,
			applies: m.study_hooper_applies,
		},
		prs: {
			title: m.study_prs_title,
			summary: m.study_prs_summary,
			applies: m.study_prs_applies,
		},
		sleep: {
			title: m.study_sleep_title,
			summary: m.study_sleep_summary,
			applies: m.study_sleep_applies,
		},
		acwr: {
			title: m.study_acwr_title,
			summary: m.study_acwr_summary,
			applies: m.study_acwr_applies,
		},
	};
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_studies()} />
	<p class="mb-[26px] max-w-[62ch] text-[15px] text-ink-dim">{m.lede_studies()}</p>

	<div class="flex flex-col gap-3">
		{#each STUDIES as s (s.id)}
			{@const p = PROSE[s.id]}
			<Card class="gap-2 p-[18px]">
				<div class="flex items-baseline justify-between gap-3">
					<span class="font-bold">{p.title()}</span>
					<span class="flex-none font-mono text-[11px] text-ink-faint">{s.year}</span>
				</div>
				<div class="font-mono text-[11px] text-ink-faint">{s.authors}</div>
				<p class="text-sm text-ink-dim">{p.summary()}</p>
				<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
					<span class="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
						{m.study_applies()}: {p.applies()}
					</span>
					<a
						href={s.url}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-[12px] text-flag hover:underline"
					>
						{m.study_link()}<ExternalLinkIcon class="size-3.5" />
					</a>
				</div>
			</Card>
		{/each}
	</div>
</section>

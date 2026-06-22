<script lang="ts">
import { goto } from '$app/navigation';
import AssessmentForm from '$lib/AssessmentForm.svelte';
import AssessmentProposal from '$lib/AssessmentProposal.svelte';
import { getContent } from '$lib/content';
import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
import * as m from '$lib/paraglide/messages';
import { trainingDays } from '$lib/programGen';
import { appMode, appState } from '$lib/state.svelte';

const content = getContent();

// Show the proposal once the form has been submitted (assessment now saved).
let done = $state(false);
const assessment = $derived(appState.assessment);
const planDays = $derived(
	assessment
		? trainingDays(content, assessment).map((k) => content.days.find((d) => d.k === k)?.label ?? k)
		: [],
);
</script>

<div class="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-5 py-10">
	<div class="absolute top-5 right-5"><LanguageSwitcher /></div>

	<h1 class="flex items-center gap-2.5 text-2xl font-black tracking-tight">
		<span class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"></span>
		SEND&nbsp;LAB
	</h1>

	{#if done && assessment}
		<AssessmentProposal
			goal={assessment.goal}
			focus={assessment.focus}
			level={assessment.level}
			{planDays}
			days={content.days}
			onStart={() => goto('/')}
			onEdit={() => (done = false)}
		/>
	{:else}
		<AssessmentForm onComplete={() => (done = true)} />
	{/if}

	{#if appMode.guest}
		<button
			type="button"
			class="self-center text-xs text-ink-dim underline decoration-dotted underline-offset-2 hover:text-ink"
			onclick={() => goto('/login')}
		>
			{m.auth_to_login()}
		</button>
	{/if}
</div>

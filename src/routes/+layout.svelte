<script lang="ts">
import '../app.css';
import { page } from '$app/state';
import { Toaster } from '$lib/components/ui/sonner';
import { TooltipProvider } from '$lib/components/ui/tooltip';
import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { startPersistence } from '$lib/state.svelte';
import { cn } from '$lib/utils';

let { children } = $props();

startPersistence();

// Keep the document language in sync with the active locale.
$effect(() => {
	document.documentElement.lang = getLocale();
});

const views = $derived([
	{ href: '/', label: m.nav_today() },
	{ href: '/week', label: m.nav_week() },
	{ href: '/exercises', label: m.nav_exercises() },
	{ href: '/metrics', label: m.nav_metrics() },
	{ href: '/log', label: m.nav_log() },
]);
</script>

<TooltipProvider delayDuration={150}>
	<header
		class="sticky top-0 z-50 border-b border-line bg-bg/80 px-5 pt-[22px] pb-[18px] backdrop-blur-lg"
	>
	<div class="flex flex-wrap items-baseline gap-3.5">
		<h1 class="flex items-center gap-2.5 text-[clamp(22px,4vw,30px)] font-black tracking-tight">
			<span class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"></span>
			SEND&nbsp;LAB
		</h1>
		<span class="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
			{m.brand_sub()}
		</span>
		<div class="ml-auto flex items-center gap-3">
			<div class="hidden text-right font-mono text-[11px] leading-relaxed text-ink-dim sm:block">
				<b class="text-chalk">60kg · 21M</b> · +50kg chin-up · 6mm pull-ups<br />
				{m.hdr_profile_prefix()}
				<b class="text-chalk">{m.hdr_profile_strong()}</b> — {m.hdr_profile_tissue()}
			</div>
			<LanguageSwitcher />
		</div>
	</div>
	<nav class="mt-4 flex flex-wrap gap-1">
		{#each views as { href, label } (href)}
			<a
				{href}
				class={cn(
					'rounded-md px-3 py-2 font-mono text-[11.5px] tracking-wider uppercase transition',
					page.url.pathname === href
						? 'bg-chalk font-bold text-bg'
						: 'text-ink-dim hover:bg-panel hover:text-ink'
				)}
			>
				{label}
			</a>
		{/each}
	</nav>
</header>

<main class="mx-auto max-w-[1080px] px-5 py-6">
	{@render children()}
</main>

<footer class="mx-auto mt-8 max-w-[1080px] border-t border-line px-5 py-5 text-xs leading-relaxed text-ink-faint">
	<Prose value={m.footer_text()} />
</footer>
</TooltipProvider>

<Toaster theme="dark" />

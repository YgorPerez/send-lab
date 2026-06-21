<script lang="ts">
import '../app.css';
import LogOutIcon from '@lucide/svelte/icons/log-out';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { authClient } from '$lib/auth-client';
import { Button } from '$lib/components/ui/button';
import { Toaster } from '$lib/components/ui/sonner';
import { TooltipProvider } from '$lib/components/ui/tooltip';
import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
import Prose from '$lib/Prose.svelte';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { appReady, appState, clearLocal, hydrate, startPersistence } from '$lib/state.svelte';
import TimerBar from '$lib/TimerBar.svelte';
import { startTimerPersistence, timer } from '$lib/timerStore.svelte';
import { cn } from '$lib/utils';

let { children } = $props();

const session = authClient.useSession();

startPersistence();
startTimerPersistence();

$effect(() => {
	document.documentElement.lang = getLocale();
});

// Redirect unauthenticated users to the login screen.
$effect(() => {
	if (!$session.isPending && !$session.data?.user && page.url.pathname !== '/login') {
		void goto('/login');
	}
});

// Load / clear the per-user state as the session changes.
let loadedFor = $state<string | null>(null);
$effect(() => {
	const uid = $session.data?.user?.id ?? null;
	if (uid && uid !== loadedFor) {
		loadedFor = uid;
		void hydrate();
	} else if (!uid && loadedFor) {
		loadedFor = null;
		clearLocal();
	}
});

// New accounts (no baseline assessment) start with onboarding.
$effect(() => {
	if (
		appReady.hydrated &&
		$session.data?.user &&
		!appState.assessment &&
		page.url.pathname !== '/welcome'
	) {
		void goto('/welcome');
	}
});

async function signOut() {
	await authClient.signOut();
	await goto('/login');
}

// Footer timer bar: visible whenever a timer is loaded/running, except on the
// Train tab (which shows the full timer inline).
const showTimerBar = $derived(
	(timer.loaded || timer.phase !== 'idle') && page.url.pathname !== '/train',
);

const views = $derived([
	{ href: '/', label: m.nav_today() },
	{ href: '/train', label: m.nav_train() },
	{ href: '/week', label: m.nav_week() },
	{ href: '/exercises', label: m.nav_exercises() },
	{ href: '/metrics', label: m.nav_metrics() },
	{ href: '/log', label: m.nav_log() },
]);
</script>

{#if $session.isPending}
	<div class="grid min-h-screen place-items-center font-mono text-xs text-ink-faint">SEND LAB</div>
{:else if !$session.data?.user}
	{#if page.url.pathname === '/login'}
		{@render children()}
	{/if}
{:else if page.url.pathname === '/welcome'}
	{@render children()}
{:else}
	<TooltipProvider delayDuration={150}>
		<header
			class="sticky top-0 z-50 border-b border-line bg-bg/80 px-5 pt-[22px] pb-[18px] backdrop-blur-lg"
		>
			<div class="flex flex-wrap items-baseline gap-3.5">
				<h1 class="flex items-center gap-2.5 text-[clamp(22px,4vw,30px)] font-black tracking-tight">
					<span
						class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"
					></span>
					SEND&nbsp;LAB
				</h1>
				<span class="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
					{m.brand_sub()}
				</span>
				<div class="ml-auto flex items-center gap-3">
					<span class="hidden font-mono text-[11px] text-ink-faint sm:inline">
						{$session.data.user.email}
					</span>
					<LanguageSwitcher />
					<Button
						variant="ghost"
						size="icon"
						class="text-ink-faint hover:text-flag"
						aria-label={m.btn_sign_out()}
						onclick={signOut}
					>
						<LogOutIcon class="size-4" />
					</Button>
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

		<main class={cn('mx-auto max-w-[1080px] px-5 py-6', showTimerBar && 'pb-28')}>
			{@render children()}
		</main>

		<footer
			class={cn(
				'mx-auto mt-8 max-w-[1080px] border-t border-line px-5 py-5 text-xs leading-relaxed text-ink-faint',
				showTimerBar && 'pb-28'
			)}
		>
			<Prose value={m.footer_text()} />
		</footer>

		{#if showTimerBar}
			<TimerBar />
		{/if}
	</TooltipProvider>
{/if}

<Toaster theme="dark" />

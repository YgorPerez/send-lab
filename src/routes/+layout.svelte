<script lang="ts">
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/roboto-mono/index.css';
import '../app.css';
import MenuIcon from '@lucide/svelte/icons/menu';
import XIcon from '@lucide/svelte/icons/x';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { authClient } from '$lib/auth-client';
import { Toaster } from '$lib/components/ui/sonner';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import SyncStatus from '$lib/SyncStatus.svelte';
import {
	appMode,
	appReady,
	appState,
	clearLocal,
	hydrate,
	hydrateGuest,
	lastUserId,
	startPersistence,
} from '$lib/state.svelte';
import TimerBar from '$lib/TimerBar.svelte';
import { startTimerPersistence, timer } from '$lib/timerStore.svelte';
import { cn } from '$lib/utils';

let { children } = $props();
let menuOpen = $state(false);

const session = authClient.useSession();

startPersistence();
startTimerPersistence();

$effect(() => {
	document.documentElement.lang = getLocale();
});

// Offline cold-start: the session check failed (no network) but we have a
// previously signed-in user — run on cached data instead of bouncing to login.
const offline = $derived(
	!$session.isPending &&
		!$session.data?.user &&
		Boolean(($session as { error?: unknown }).error) &&
		lastUserId() != null,
);

// Redirect to login only when there's no way to run: no account, not offline,
// and the user hasn't chosen guest mode.
$effect(() => {
	if (
		!$session.isPending &&
		!$session.data?.user &&
		!offline &&
		!appMode.guest &&
		page.url.pathname !== '/login'
	) {
		void goto('/login');
	}
});

// Load / clear state as the session (or guest mode) changes.
let loadedFor = $state<string | null>(null);
$effect(() => {
	const uid = $session.data?.user?.id ?? null;
	if (uid) {
		if (uid !== loadedFor) {
			loadedFor = uid;
			void hydrate(uid);
		}
	} else if (appMode.guest) {
		if (loadedFor !== 'guest') {
			loadedFor = 'guest';
			hydrateGuest();
		}
	} else if (offline && loadedFor == null) {
		loadedFor = lastUserId();
		void hydrate();
	} else if (!offline && loadedFor) {
		loadedFor = null;
		clearLocal();
	}
});

// First run (account or guest) with no baseline assessment starts onboarding —
// but never trap a guest who's heading to /login to make a real account.
$effect(() => {
	if (
		appReady.hydrated &&
		($session.data?.user || appMode.guest) &&
		!appState.assessment &&
		page.url.pathname !== '/welcome' &&
		page.url.pathname !== '/login' &&
		page.url.pathname !== '/train'
	) {
		void goto('/welcome');
	}
});

// Footer timer bar: visible whenever a timer is loaded/running, except on the
// Train tab (which shows the full timer inline).
const showTimerBar = $derived(
	(timer.loaded || timer.phase !== 'idle') && page.url.pathname !== '/train',
);

const views = $derived([
	{ href: '/', label: m.nav_today() },
	{ href: '/train', label: m.nav_train() },
	{ href: '/week', label: m.nav_week() },
	{ href: '/program', label: m.nav_program() },
	{ href: '/exercises', label: m.nav_exercises() },
	{ href: '/metrics', label: m.nav_metrics() },
	{ href: '/stats', label: m.nav_stats() },
	{ href: '/log', label: m.nav_log() },
	{ href: '/studies', label: m.nav_studies() },
	{ href: '/settings', label: m.nav_settings() },
]);
</script>

{#if $session.isPending}
	<div class="grid min-h-screen place-items-center font-mono text-xs text-ink-faint">SEND LAB</div>
{:else if page.url.pathname === '/login' && !$session.data?.user}
	{@render children()}
{:else if !$session.data?.user && !offline && !appMode.guest}
	<!-- no account / guest / offline session → the redirect effect sends to /login -->
{:else if page.url.pathname === '/welcome'}
	{@render children()}
{:else}
	<div style="display: contents">
		<header
			class="sticky top-0 z-50 border-b border-line bg-bg/80 px-5 pt-[22px] pb-[18px] backdrop-blur-lg"
		>
			<div class="flex items-center justify-between gap-3">
				<h1 class="flex items-center gap-2.5 text-[clamp(20px,5vw,28px)] font-black tracking-tight">
					<span
						class="inline-block h-6 w-3 -skew-x-12 bg-flag shadow-[3px_0_0_var(--flag-deep)]"
					></span>
					SEND&nbsp;LAB
				</h1>
				<div class="flex items-center gap-3">
					<SyncStatus />
					<button
						type="button"
						class="text-ink-dim transition hover:text-ink md:hidden"
						aria-label={m.nav_menu()}
						aria-expanded={menuOpen}
						onclick={() => (menuOpen = !menuOpen)}
					>
						{#if menuOpen}<XIcon class="size-5" />{:else}<MenuIcon class="size-5" />{/if}
					</button>
				</div>
			</div>
			<nav
				class={cn(
					'mt-4 gap-1 md:flex md:flex-row md:flex-wrap',
					menuOpen ? 'flex flex-col' : 'hidden'
				)}
			>
				{#each views as { href, label } (href)}
					<a
						{href}
						onclick={() => (menuOpen = false)}
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

		{#if showTimerBar}
			<TimerBar />
		{/if}
	</div>
{/if}

<Toaster theme="dark" />

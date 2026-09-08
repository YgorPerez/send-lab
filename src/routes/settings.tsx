// SETTINGS.
//
// A list of controls, and the page where two rules get tested first.
//
// THE SPLIT (#24): PREFERENCES WORK OFFLINE, ACCOUNT ACTIONS DO NOT
// -----------------------------------------------------------------
// `prefs` is part of the training record and already in the local store, so
// units, language and notifications save on the device and sync when they can —
// the same path as a ticked task. Signing out and the API token need the server:
// sign-out must not be offered offline at all (an offline sign-out would orphan
// unsynced work), and a token cannot be read from a device that has never seen
// it. The page says which half a control is in rather than letting an action fail
// silently in a gym basement: an "Offline" chip in the header, one line of copy,
// and the account controls dropping their fill.
//
// THE RATION: NO `primary` ON THIS SCREEN
// ---------------------------------------
// A settings page is where "one primary per screen" breaks first, because every
// section has a button. None of them is the thing the athlete came to do. The one
// primary is inside the alert dialog — confirming a token regeneration — where it
// is the only action on its surface.
//
// `cueNotices` is rendered as it exists: one boolean, driving local notifications
// only (#27's research found no push path anywhere in the tree). #75 split the old
// `notify` into the two fields the two capabilities need; **this page still shows
// one switch**, because the second one — the daily notice — has no push path
// behind it until #81, and a switch that turns on nothing is the dishonesty the
// split was made to end. So the cue half is wired here and the daily half waits
// for the machinery it needs. The permission prompt is asked for at the moment
// the switch is turned on, not before.
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { readToken, regenerateToken } from '$lib/apiTokenClient';
import { useOnline } from '$lib/online';
import * as m from '$lib/paraglide/messages';
import { APP_LOCALES, type AppLocale, chooseLocale, currentLocale } from '$lib/store/locale';
import { writePrefs } from '$lib/store/prefs';
import {
	type Prefs,
	recordSync,
	useActiveAccount,
	useRefusedWork,
	useTrainingRecord,
} from '$lib/store/record';
import { AlertDialog } from '../components/ui/AlertDialog';
import { Bare, Empty, Eyebrow, Pane, Section } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { Switch } from '../components/ui/Switch';
import { button, card, chip } from '../components/ui/variants';
import { authClient, signOut } from '../lib/auth-client';

export const Route = createFileRoute('/settings')({ component: Settings });

function Settings() {
	// Live, like every screen: a preference changed on another device arrives
	// through the same collection and the row here updates without this page
	// knowing anything about how.
	const { prefs } = useTrainingRecord();
	const online = useOnline();

	return (
		// One pane at every width (#52): a list of controls, and width adds nothing.
		<Pane>
			<header className="flex items-baseline justify-between gap-2 pt-1.5">
				<h1 className="h-screen-title">{m.sec_settings()}</h1>
				{online ? null : <span className={chip({ tone: 'warn' })}>{m.sync_offline()}</span>}
			</header>

			{online ? null : (
				<p className="-mt-3 text-[12.5px] leading-snug text-ink-dim">{m.set_offline_note()}</p>
			)}

			<Units prefs={prefs} />
			<Language />
			<Notifications cueNotices={prefs.cueNotices} />
			<Account online={online} />
		</Pane>
	);
}

/** One control on its own line: what it is on the left, the control on the right.
 *  No horizontal padding of its own — inside a `card` the card supplies it, and
 *  inside a `Bare` the row sits flush with the rule above it. */
function ControlRow({
	id,
	label,
	children,
}: {
	id?: string;
	label: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-11 items-center justify-between gap-3 py-1.5">
			<span id={id} className="text-[13px] text-ink">
				{label}
			</span>
			{children}
		</div>
	);
}

/** One line saying why a control did not do what was asked — a refused
 *  permission, a held sign-out, a token the server could not be reached for.
 *  Gold, because it is a warning about this device rather than a stop. */
function Caveat({ children }: { children: ReactNode }) {
	return <p className="text-[12.5px] leading-snug text-gold">{children}</p>;
}

const WEIGHT = [
	{ id: 'kg', label: 'kg' },
	{ id: 'lb', label: 'lb' },
] as const;
const LENGTH = [
	{ id: 'mm', label: 'mm' },
	{ id: 'in', label: 'in' },
] as const;

/** Display units. Storage is canonical — kilograms and millimetres, always —
 *  and these choose what the athlete reads. The unit codes are shown as-is in
 *  both locales: `kg` is `kg` in Portuguese, and it is an identifier rather than
 *  copy. Two rows sharing an edge, which is what earns the `card`. */
function Units({ prefs }: { prefs: Prefs }) {
	return (
		<Section label={m.set_units()}>
			<div className={card({ pad: 'none', class: 'divide-y divide-line-soft [&>*]:px-3' })}>
				<ControlRow label={m.field_weight()}>
					<Segmented
						value={prefs.weight}
						options={WEIGHT}
						onChange={(weight) => void writePrefs({ weight })}
						className="num flex w-[132px] gap-1.5"
					/>
				</ControlRow>
				<ControlRow label={m.set_length()}>
					<Segmented
						value={prefs.length}
						options={LENGTH}
						onChange={(length) => void writePrefs({ length })}
						className="num flex w-[132px] gap-1.5"
					/>
				</ControlRow>
			</div>
		</Section>
	);
}

/** Message functions, not strings: each reads the locale when called, which is
 *  after the root has re-keyed the tree on a switch. */
const LANGUAGE_LABEL: Record<AppLocale, () => string> = { 'en-US': m.lang_en, 'pt-BR': m.lang_pt };

/**
 * The locale, in full. The strip's switch says `EN` / `PT` because it has 60px;
 * this one has the line and says the language's name. Both go through
 * `chooseLocale`, which writes the device and the account (#57) and tells the
 * root to re-render everything — and both read `currentLocale()`, the store's
 * answer, rather than Paraglide's directly, so there is one place the live
 * locale comes from. Read at render rather than held: the root re-keys the whole
 * subtree on a switch, so this page remounts and reads the new answer.
 */
function Language() {
	const locale = currentLocale();
	return (
		<Section label={m.lang_label()}>
			<Segmented
				value={locale}
				options={APP_LOCALES.map((id) => ({ id, label: LANGUAGE_LABEL[id]() }))}
				onChange={chooseLocale}
				className="flex gap-1.5"
			/>
		</Section>
	);
}

/** Whether the browser can be asked at all, and what it has already said. Read
 *  behind a guard because the string render has no `Notification`. */
function notificationPermission(): NotificationPermission | 'unsupported' {
	return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function Notifications({ cueNotices }: { cueNotices: boolean }) {
	const [refused, setRefused] = useState<'denied' | 'unsupported' | null>(null);
	const labelId = useId();
	// The stored boolean is the switch — `cueNotices` as it exists (#62, point 4).
	// Reconciling it against the browser's permission, so a revoked permission
	// shows as off, is #81's "a switch that lies" and lands with the daily-notice
	// switch beside it.

	async function toggle(on: boolean) {
		setRefused(null);
		if (!on) {
			void writePrefs({ cueNotices: false });
			return;
		}
		const permission = notificationPermission();
		if (permission === 'unsupported') {
			setRefused('unsupported');
			return;
		}
		// Asked at the tap, and only then: the prompt arrives attached to a switch
		// the athlete just touched, so its purpose is self-evident.
		const answer = permission === 'granted' ? permission : await Notification.requestPermission();
		if (answer === 'granted') void writePrefs({ cueNotices: true });
		// `'default'` is the athlete closing the prompt without answering it (#82).
		// Nothing is blocked and no site-settings trip would help — tapping the
		// switch again simply asks again — so the switch stays off and says nothing.
		else if (answer === 'denied') setRefused('denied');
	}

	return (
		<Section label={m.notifications_title()}>
			{/* One row, so no `card`: a box around a single line is the furniture
			    `Bare` exists to replace. */}
			<Bare>
				<ControlRow id={labelId} label={m.set_cue_notices_desc()}>
					<Switch
						checked={cueNotices}
						onCheckedChange={(on) => void toggle(on)}
						labelledBy={labelId}
					/>
				</ControlRow>
			</Bare>
			{refused ? (
				<Caveat>
					{refused === 'denied' ? m.notifications_denied() : m.notifications_unsupported()}
				</Caveat>
			) : null}
		</Section>
	);
}

/**
 * The account, and the two things that need the server.
 *
 * Keyed on the store's active account, not on the session. Offline, the session
 * fetch fails and `useSession` reports nobody — but the store trusts the local
 * record offline (#24, #58) and `__root.tsx` keeps the remembered account for
 * exactly that reason. Reading the session here would tell a signed-in athlete
 * in a gym basement that they are signed out, on the same screen whose header
 * says the account controls need a connection. So: an account in the store is
 * signed in, and the session only adds the email once it has answered.
 *
 * With no account, the section waits for the session rather than guessing, and
 * signed out it is an `Empty`: the one affordance that fills it is signing in.
 */
function Account({ online }: { online: boolean }) {
	const account = useActiveAccount();
	const { data: session, isPending } = authClient.useSession();

	if (account) {
		return (
			<>
				<SignedIn email={session?.user?.email ?? null} online={online} />
				<ApiToken online={online} />
			</>
		);
	}
	if (isPending) return null;

	return (
		<Section label={m.set_account()}>
			<Empty
				value={m.set_signed_out()}
				action={
					<Link to="/login" className={button({ size: 'md', class: 'min-h-11' })}>
						{m.btn_sign_in()}
					</Link>
				}
			/>
		</Section>
	);
}

function SignedIn({ email, online }: { email: string | null; online: boolean }) {
	const [busy, setBusy] = useState(false);
	const [held, setHeld] = useState(false);
	// Said whether or not the athlete ever tries to leave: a refusal arrives as a
	// 200 and has no other symptom, and this is the screen it is surfaced for. Live
	// rather than read at mount, because most flushes are not this screen's doing —
	// the debounce fires after any write, including the units and language switches
	// above, and the reconnect fires on its own.
	const refusedWork = useRefusedWork();

	// Sign-out only after the unsynced work has gone (#24, #58) — the half of it
	// that can still go. Flushing first is the attempt; if anything is still
	// sendable after it, the device is offline after all: the sign-out is held and
	// the page says so, because signing out with training still on the device is
	// how it is lost.
	//
	// A refusal is not that case, and gating on `unsynced()` — which counts it —
	// held sign-out on this device forever (#82). It is unsynced work in its final
	// state (`CONTEXT.md`): no flush can bring that count down, and the rows stay
	// under this account's prefix after a sign-out either way. So it is said rather
	// than waited for.
	async function leave() {
		setBusy(true);
		setHeld(false);
		try {
			const sync = recordSync();
			if (sync) {
				await sync.flush();
				if (sync.sendable() > 0) {
					setHeld(true);
					return;
				}
			}
			await signOut();
		} finally {
			setBusy(false);
		}
	}

	return (
		<Section label={m.set_account()}>
			<Bare className="flex flex-wrap items-center justify-between gap-3">
				{/* The email is the session's answer, so offline on a cold load there
				    is none: the eyebrow stands alone rather than showing a guess. */}
				<div className="min-w-0">
					<Eyebrow>{m.field_email()}</Eyebrow>
					{email ? <p className="truncate text-[13px] text-ink">{email}</p> : null}
				</div>
				<button
					type="button"
					disabled={!online || busy}
					onClick={() => void leave()}
					className={button({ size: 'md', class: 'min-h-11' })}
				>
					{m.btn_sign_out()}
				</button>
			</Bare>
			{held ? <Caveat>{m.set_unsynced_holds_signout()}</Caveat> : null}
			{refusedWork ? <Caveat>{m.set_refused_note()}</Caveat> : null}
		</Section>
	);
}

/** The MCP client config in the shape every file-based client reads —
 *  `mcpServers` with a URL and a bearer header — so one copy covers any client. */
function configFor(endpoint: string, token: string): string {
	return JSON.stringify(
		{
			mcpServers: {
				'send-lab': {
					type: 'http',
					url: endpoint,
					headers: { Authorization: `Bearer ${token}` },
				},
			},
		},
		null,
		2,
	);
}

/** What stands in for the token until it is revealed. The `sl_` prefix is the
 *  one `server/apiToken.ts` mints, repeated here so the masked config reads as
 *  the real one with the secret covered rather than as a placeholder. */
const MASKED = `sl_${'•'.repeat(12)}`;

/**
 * The API token panel. Strings predate the rebuild — they are the only MCP trace
 * in `src/` — and `/mcp` itself is #68's; the URL is composed from this origin
 * because that is where it will answer.
 *
 * The token is fetched, never cached on the device: it is the one credential
 * that grants everything, and it lives in one place on purpose. Offline, the
 * panel says so and its controls drop their fill.
 */
function ApiToken({ online }: { online: boolean }) {
	const [token, setToken] = useState<string | null>(null);
	const [unreachable, setUnreachable] = useState(false);
	const [revealed, setRevealed] = useState(false);
	const [copied, setCopied] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);

	// Fetched in an effect rather than a loader (ADR 0006), and again whenever the
	// device comes back online — that is the moment a panel that said "couldn't
	// reach the server" should stop saying it.
	useEffect(() => {
		if (!online) return;
		let cancelled = false;
		readToken()
			.then((t) => {
				if (cancelled) return;
				setToken(t);
				setUnreachable(false);
			})
			.catch(() => {
				if (!cancelled) setUnreachable(true);
			});
		return () => {
			cancelled = true;
		};
	}, [online]);

	// "Copied" is a moment, not a state: it clears itself.
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(timer);
	}, [copied]);

	const origin = typeof window === 'undefined' ? '' : window.location.origin;
	const endpoint = `${origin}/mcp`;
	const available = online && token !== null;

	async function copy() {
		if (!token) return;
		try {
			await navigator.clipboard.writeText(configFor(endpoint, token));
			setCopied(true);
		} catch {
			// Clipboard denied. The config is on screen once revealed.
		}
	}

	async function regenerate() {
		setBusy(true);
		try {
			const fresh = await regenerateToken();
			setToken(fresh);
			// Shown, so it can be copied into the client that just lost the old one.
			setRevealed(true);
		} catch {
			setUnreachable(true);
		} finally {
			// Closed on both paths (#82). On the failing one the only feedback is
			// the caveat on the page behind it, so a dialog left open renders the
			// answer under its own backdrop and the athlete sees the confirm button
			// re-enable with no message at all.
			setConfirming(false);
			setBusy(false);
		}
	}

	return (
		<Section label={m.mcp_title()}>
			<p className="text-[12.5px] leading-snug text-ink-dim">{m.mcp_desc()}</p>
			<p className="text-[12px] leading-snug text-ink-faint">{m.mcp_agnostic_note()}</p>

			<div>
				<Eyebrow className="mb-1">{m.mcp_config_note()}</Eyebrow>
				<pre
					className={card({
						pad: 'sm',
						tone: 'inset',
						class: 'num overflow-x-auto text-[11px] leading-relaxed text-ink-dim',
					})}
				>
					{configFor(endpoint, revealed && token ? token : MASKED)}
				</pre>
			</div>

			{!online || unreachable ? <Caveat>{m.set_token_unavailable()}</Caveat> : null}

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					disabled={!available}
					onClick={() => void copy()}
					className={button({ size: 'md', class: 'min-h-11' })}
				>
					{copied ? <Check size={14} /> : <Copy size={14} />}
					{copied ? m.mcp_copied() : m.mcp_copy()}
				</button>
				<button
					type="button"
					disabled={!available}
					aria-pressed={revealed}
					onClick={() => setRevealed((r) => !r)}
					className={button({ size: 'md', class: 'min-h-11' })}
				>
					{revealed ? <EyeOff size={14} /> : <Eye size={14} />}
					{revealed ? m.mcp_hide() : m.mcp_reveal()}
				</button>
				<button
					type="button"
					disabled={!online}
					onClick={() => setConfirming(true)}
					className={button({ size: 'md', class: 'min-h-11' })}
				>
					<RefreshCw size={14} />
					{m.mcp_regenerate()}
				</button>
			</div>

			<p className="text-[12px] leading-snug text-ink-faint">
				{m.mcp_connector_note({ url: endpoint })}
			</p>

			{/* Regeneration is the alert-dialog case: it invalidates a token the
			    athlete has configured in another client, and nothing here can undo it. */}
			<AlertDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={m.mcp_regenerate()}
				description={m.mcp_regenerate_confirm()}
				cancel={m.btn_cancel()}
				confirm={m.mcp_regenerate()}
				onConfirm={() => void regenerate()}
				busy={busy}
			/>
		</Section>
	);
}

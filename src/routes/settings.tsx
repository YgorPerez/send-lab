// SETTINGS.
//
// A list of controls, and the page where two rules get tested first.
//
// THE SPLIT (#24): PREFERENCES WORK OFFLINE, ACCOUNT ACTIONS DO NOT
// -----------------------------------------------------------------
// `prefs` is account data already in the local store, so units, language and
// notifications save on the device and sync when they can — the same path as a
// ticked task. Signing out and the API token need the server: sign-out must not
// be offered offline at all (an offline sign-out would orphan unsynced work), and
// a token cannot be read from a device that has never seen it. The page says which
// half a control is in rather than letting an action fail silently in a gym
// basement: an "Offline" chip in the header, one line of copy, and the account
// controls dropping their fill.
//
// THE RATION: NO `primary` ON THIS SCREEN
// ---------------------------------------
// A settings page is where "one primary per screen" breaks first, because every
// section has a button. None of them is the thing the athlete came to do. The one
// primary is inside the alert dialog — confirming a token regeneration — where it
// is the only action on its surface.
//
// `notify` is rendered as it exists: one boolean, driving local notifications
// only (#27's research found no push path anywhere in the tree). #75 replaces the
// field and #81 builds the two switches that take its place; this page does not
// build a push path in the meantime, and the permission prompt is asked for at
// the moment the switch is turned on, not before.
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { readToken, regenerateToken } from '$lib/apiTokenClient';
import { useOnline } from '$lib/online';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { APP_LOCALES, type AppLocale, chooseLocale } from '$lib/store/locale';
import { writePrefs } from '$lib/store/prefs';
import { type Prefs, recordSync, useTrainingRecord } from '$lib/store/record';
import { AlertDialog } from '../components/ui/AlertDialog';
import { Empty, Eyebrow, Pane, Section } from '../components/ui/primitives';
import { Switch } from '../components/ui/Switch';
import { button, card, chip, option } from '../components/ui/variants';
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
			<Notifications notify={prefs.notify} />
			<Account online={online} />
		</Pane>
	);
}

/** One control on its own line: what it is on the left, the control on the right. */
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
		<div className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
			<span id={id} className="text-[13px] text-ink">
				{label}
			</span>
			{children}
		</div>
	);
}

/**
 * Two choices side by side. `option` rather than a `Picker`: with two values the
 * whole set fits on the line, and a select that opens to show two rows is a
 * control with a step in it for nothing. `aria-pressed`, because each is a
 * toggle button and the pair is the value.
 */
function Segmented<T extends string>({
	value,
	options,
	onChange,
	className,
}: {
	value: T;
	options: readonly { id: T; label: string }[];
	onChange: (next: T) => void;
	className?: string;
}) {
	return (
		<div className={className ?? 'flex gap-1.5'}>
			{options.map((o) => (
				<button
					key={o.id}
					type="button"
					aria-pressed={o.id === value}
					onClick={() => {
						if (o.id !== value) onChange(o.id);
					}}
					className={option({ on: o.id === value })}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

/** Display units. Storage is canonical — kilograms and millimetres, always —
 *  and these choose what the athlete reads. The unit codes are shown as-is in
 *  both locales: `kg` is `kg` in Portuguese, and it is an identifier rather than
 *  copy. */
const WEIGHT = [
	{ id: 'kg', label: 'kg' },
	{ id: 'lb', label: 'lb' },
] as const;
const LENGTH = [
	{ id: 'mm', label: 'mm' },
	{ id: 'in', label: 'in' },
] as const;

function Units({ prefs }: { prefs: Prefs }) {
	return (
		<Section label={m.set_units()}>
			<div className={card({ pad: 'none', class: 'divide-y divide-line-soft' })}>
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

/**
 * The locale, in full. The strip's switch says `EN` / `PT` because it has 60px;
 * this one has the line and says the language's name. Both go through
 * `chooseLocale`, which writes the device and the account (#57) and tells the
 * root to re-render everything.
 *
 * `getLocale()` at render rather than state: the root re-keys the whole subtree
 * on a switch, so this page remounts and reads the new answer.
 */
/** Message functions, not strings: each reads the locale when called, which is
 *  after the root has re-keyed the tree on a switch. */
const LANGUAGE_LABEL: Record<AppLocale, () => string> = { 'en-US': m.lang_en, 'pt-BR': m.lang_pt };

function Language() {
	const locale = getLocale() as AppLocale;
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

function Notifications({ notify }: { notify: boolean }) {
	const [refused, setRefused] = useState<'denied' | 'unsupported' | null>(null);
	// The switch shows the truth, not the stored intent (#81's rule, applied
	// early): a preference that says on while the browser says denied is a switch
	// that lies, and the athlete would wait for a notification that never comes.
	const granted = notificationPermission() === 'granted';
	const checked = notify && granted;

	async function toggle(on: boolean) {
		setRefused(null);
		if (!on) {
			void writePrefs({ notify: false });
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
		if (answer === 'granted') void writePrefs({ notify: true });
		else setRefused('denied');
	}

	return (
		<Section label={m.notify_toggle()}>
			<div className={card({ pad: 'none' })}>
				<ControlRow id="notify-label" label={m.set_notify_desc()}>
					<Switch
						checked={checked}
						onCheckedChange={(on) => void toggle(on)}
						labelledBy="notify-label"
					/>
				</ControlRow>
			</div>
			{refused ? (
				<p className="text-[12.5px] leading-snug text-gold">
					{refused === 'denied' ? m.notify_denied() : m.notify_unsupported()}
				</p>
			) : null}
		</Section>
	);
}

/**
 * The account, and the two things that need the server.
 *
 * `authClient.useSession()` starts pending and, with no network, stays there;
 * the section renders nothing until it resolves rather than guessing. Signed out
 * it is an `Empty`: the one affordance that fills it is signing in.
 */
function Account({ online }: { online: boolean }) {
	const { data: session, isPending } = authClient.useSession();
	if (isPending) return null;

	if (!session?.user) {
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

	return (
		<>
			<SignedIn email={session.user.email} online={online} />
			<ApiToken online={online} />
		</>
	);
}

function SignedIn({ email, online }: { email: string; online: boolean }) {
	const [busy, setBusy] = useState(false);
	const [held, setHeld] = useState(false);

	// Sign-out only after the unsynced work has gone (#24, #58). Flushing first is
	// the attempt; if anything is still unsent after it — offline after all, or a
	// refusal that will never send — the sign-out is held and the page says so,
	// because signing out with training still on the device is how it is lost.
	async function leave() {
		setBusy(true);
		setHeld(false);
		try {
			const sync = recordSync();
			if (sync) {
				await sync.flush();
				if (sync.unsynced() > 0) {
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
			<div className={card({ pad: 'none' })}>
				<div className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-3 py-2">
					<div className="min-w-0">
						<Eyebrow>{m.field_email()}</Eyebrow>
						<p className="truncate text-[13px] text-ink">{email}</p>
					</div>
					<button
						type="button"
						disabled={!online || busy}
						onClick={() => void leave()}
						className={button({ size: 'md', class: 'min-h-11' })}
					>
						{m.btn_sign_out()}
					</button>
				</div>
			</div>
			{held ? (
				<p className="text-[12.5px] leading-snug text-gold">{m.set_unsynced_holds_signout()}</p>
			) : null}
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
			setConfirming(false);
		} catch {
			setUnreachable(true);
		} finally {
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

			{!online || unreachable ? (
				<p className="text-[12.5px] leading-snug text-gold">{m.set_token_unavailable()}</p>
			) : null}

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

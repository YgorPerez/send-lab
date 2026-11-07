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
// silently in a gym basement: one line of copy, and the account controls dropping
// their fill. The "Offline" chip that used to head this page went to the top
// strip with #83, where it is on every screen; what is left here is the half only
// this page can say, which is *which of these controls* the connection decides.
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
import { useEffect, useId, useState } from 'react';
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
import { CueSettings } from '../components/CueSettings';
import { AlertDialog } from '../components/ui/AlertDialog';
import {
	Bare,
	ControlList,
	ControlNote,
	ControlRow,
	Empty,
	Eyebrow,
	Notice,
	Pane,
	ScreenHeader,
	Section,
} from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { Switch } from '../components/ui/Switch';
import { button, card } from '../components/ui/variants';
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
			{/* The "Offline" chip that used to sit here moved into the top strip
			    (#83), where it is on every screen instead of the two that happened
			    to need it. What stays is the line below it, which is this page's own
			    half of the answer: not *that* the device is offline, but which of
			    these controls that stops working. */}
			<ScreenHeader title={m.sec_settings()} />

			{/* A notice about the whole page is the first group under the header,
			    a sections gap below it (#122), not a second meta line pulled up
			    into the header. Gold, as sign-in says offline: a warning about
			    this device. */}
			{online ? null : <Notice tone="warn">{m.set_offline_note()}</Notice>}

			{/* Every group below is the same thing (#122, spec story 69): an Inter
			    section head over one `ControlList`, a card of 56px `ControlRow`s,
			    whether it holds one row or four. The API token is the exception the
			    group pattern names: prose, a config and actions, so a `Bare`. */}
			<Display prefs={prefs} />
			{/* The same rows the Timer screen opens from the strip (#105, #119). */}
			<Section face="sans" label={m.cues_title()}>
				<CueSettings />
			</Section>
			<Notifications cueNotices={prefs.cueNotices} />
			<Account online={online} />
		</Pane>
	);
}

const WEIGHT = [
	{ id: 'kg', label: 'kg' },
	{ id: 'lb', label: 'lb' },
] as const;
const LENGTH = [
	{ id: 'mm', label: 'mm' },
	{ id: 'in', label: 'in' },
] as const;

/** What the athlete reads things in: the units and the language, one group
 *  (#122, spec story 70: display choices live together).
 *
 *  Storage is canonical — kilograms and millimetres, always — and the units
 *  choose what the athlete reads. The unit codes are shown as-is in both
 *  locales: `kg` is `kg` in Portuguese, and it is an identifier rather than copy.
 *  Set in Inter since #122, like every other choice on the page: mono is for
 *  readings that are all digits, and `kg` is a word. */
function Display({ prefs }: { prefs: Prefs }) {
	const weightId = useId();
	const lengthId = useId();
	return (
		<Section face="sans" label={m.set_units()}>
			<ControlList>
				<ControlRow id={weightId} label={m.field_weight()}>
					<Segmented
						value={prefs.weight}
						options={WEIGHT}
						onChange={(weight) => void writePrefs({ weight })}
						labelledBy={weightId}
						className="flex w-[132px] shrink-0 gap-1.5"
					/>
				</ControlRow>
				<ControlRow id={lengthId} label={m.set_length()}>
					<Segmented
						value={prefs.length}
						options={LENGTH}
						onChange={(length) => void writePrefs({ length })}
						labelledBy={lengthId}
						className="flex w-[132px] shrink-0 gap-1.5"
					/>
				</ControlRow>
				<Language />
			</ControlList>
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
	const id = useId();
	return (
		<ControlRow id={id} label={m.lang_label()}>
			<Segmented
				value={locale}
				options={APP_LOCALES.map((id) => ({ id, label: LANGUAGE_LABEL[id]() }))}
				onChange={chooseLocale}
				labelledBy={id}
				className="flex w-[184px] shrink-0 gap-1.5"
			/>
		</ControlRow>
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
	const noteId = useId();
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
		<Section face="sans" label={m.notifications_title()}>
			{/* One row, and still a card: a list of controls is a card of rows, one
			    row or many (#122). As a `Bare` it was the one group on the page that
			    looked like prose. */}
			<ControlList>
				<div>
					<ControlRow id={labelId} label={m.set_cue_notices_desc()}>
						<Switch
							checked={cueNotices}
							onCheckedChange={(on) => void toggle(on)}
							labelledBy={labelId}
							describedBy={refused ? noteId : undefined}
						/>
					</ControlRow>
					{refused ? (
						<ControlNote id={noteId} role="status">
							{refused === 'denied' ? m.notifications_denied() : m.notifications_unsupported()}
						</ControlNote>
					) : null}
				</div>
			</ControlList>
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
		<Section face="sans" label={m.set_account()}>
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
	// 200 and has no other symptom. Since #84 this is no longer the *only* place it
	// is said — the strip announces it on every screen, because a surface the
	// athlete has to go looking for is not a surface — and what this keeps is the
	// detail: which control the refusal changes, and that sign-out no longer waits
	// for the work. Live rather than read at mount, because most flushes are not
	// this screen's doing — the debounce fires after any write, including the units
	// and language switches above, and the reconnect fires on its own.
	const refusedWork = useRefusedWork();
	const offlineId = useId();
	const heldId = useId();
	const refusedId = useId();
	const described = [!online && offlineId, held && heldId, refusedWork && refusedId]
		.filter(Boolean)
		.join(' ');

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
		<Section face="sans" label={m.set_account()}>
			<ControlList>
				<div>
					{/* The email is the session's answer, so offline on a cold load
					    there is none: the row says who is signed in only once it is
					    known, and that someone is, which the store already knows. */}
					<ControlRow
						label={
							<span className="block truncate" title={email ?? undefined}>
								{email ?? m.set_signed_in()}
							</span>
						}
					>
						<button
							type="button"
							disabled={!online || busy}
							onClick={() => void leave()}
							aria-describedby={described || undefined}
							className={button({ size: 'md', class: 'min-h-11 shrink-0' })}
						>
							{m.btn_sign_out()}
						</button>
					</ControlRow>
					{/* Why Sign out is off or waiting, under it (#122's critique): at
					    360px the page's offline line is two screens up. Each line is
					    the button's description; the held one is a status, because
					    it answers a tap. */}
					{online ? null : <ControlNote id={offlineId}>{m.set_signout_offline()}</ControlNote>}
					{held ? (
						<ControlNote id={heldId} role="status">
							{m.set_unsynced_holds_signout()}
						</ControlNote>
					) : null}
					{refusedWork ? <ControlNote id={refusedId}>{m.set_refused_note()}</ControlNote> : null}
				</div>
			</ControlList>
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
		<Section face="sans" label={m.mcp_title()}>
			{/* Not a list of controls but prose, a config and the actions on it, so
			    the group pattern's other body: a `Bare` (DESIGN.md › The group
			    pattern). */}
			<Bare className="flex flex-col gap-group">
				<p className="text-[13px] leading-snug text-ink-dim">{m.mcp_desc()}</p>
				<p className="text-[13px] leading-snug text-pretty text-ink-faint">
					{m.mcp_agnostic_note()}
				</p>

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

				{/* Offline nothing was asked, so the line says what the token waits for;
				    online, a request that failed says the server could not be reached. */}
				{!online ? (
					<Notice tone="warn">{m.set_token_offline()}</Notice>
				) : unreachable ? (
					<Notice tone="warn">{m.set_token_unavailable()}</Notice>
				) : null}

				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						disabled={!available}
						onClick={() => void copy()}
						className={button({ size: 'md', class: 'min-h-11' })}
					>
						{copied ? (
							<Check size={16} aria-hidden="true" />
						) : (
							<Copy size={16} aria-hidden="true" />
						)}
						{copied ? m.mcp_copied() : m.mcp_copy()}
					</button>
					<button
						type="button"
						disabled={!available}
						aria-pressed={revealed}
						onClick={() => setRevealed((r) => !r)}
						className={button({ size: 'md', class: 'min-h-11' })}
					>
						{revealed ? (
							<EyeOff size={16} aria-hidden="true" />
						) : (
							<Eye size={16} aria-hidden="true" />
						)}
						{revealed ? m.mcp_hide() : m.mcp_reveal()}
					</button>
					<button
						type="button"
						disabled={!online}
						onClick={() => setConfirming(true)}
						className={button({ size: 'md', class: 'min-h-11' })}
					>
						<RefreshCw size={16} aria-hidden="true" />
						{m.mcp_regenerate()}
					</button>
				</div>

				<p className="text-[13px] leading-snug text-pretty text-ink-faint">
					{m.mcp_connector_note({ url: endpoint })}
				</p>
			</Bare>

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

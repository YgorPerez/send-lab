// A question that waits says why (#125's sweep, left by #111 and #119).
//
// Deleting a saved protocol waits for the account to answer first, and offline
// that is until the device is back: the confirm went busy and the question sat
// there with nothing saying why. A held control says why under it, in a
// `Notice` it is described by, on every screen (Train's finish, the intake's
// advance, Settings' offline controls); the dialog now can too.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { AlertDialog } from '../src/components/ui/AlertDialog.tsx';

beforeAll(() => {
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let unmount: (() => void) | null = null;
afterEach(() => {
	unmount?.();
	unmount = null;
});

function show(held: string | null) {
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	act(() =>
		root.render(
			createElement(AlertDialog, {
				open: true,
				onOpenChange: () => {},
				title: 'Delete “Warm-up”?',
				description: 'It is removed on every device.',
				cancel: 'Cancel',
				confirm: 'Delete',
				onConfirm: () => {},
				busy: held != null,
				held,
			}),
		),
	);
	unmount = () => {
		act(() => root.unmount());
		host.remove();
	};
}

const confirm = () =>
	[...document.querySelectorAll('button')].find((b) => b.textContent === 'Delete');

describe('AlertDialog', () => {
	test('a held confirm says why under it, and is described by the line', () => {
		show('Deleting waits for a connection.');
		const line = document.querySelector('[data-notice]');
		expect(line?.textContent).toBe('Deleting waits for a connection.');
		expect(line?.getAttribute('data-notice')).toBe('warn');
		expect(confirm()?.disabled).toBe(true);
		expect(confirm()?.getAttribute('aria-describedby')).toBe(line?.id);
	});

	test('says nothing while nothing holds it', () => {
		show(null);
		expect(document.querySelector('[data-notice]')).toBeNull();
		expect(confirm()?.hasAttribute('aria-describedby')).toBe(false);
	});
});

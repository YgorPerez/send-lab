// The on/off control — a preference that is either in force or not.
//
// Base UI rather than a styled checkbox or an `aria-pressed` button: a switch
// announces itself as one, and the athlete's screen reader says "on" and "off"
// rather than "pressed". Settings is its first use (#62); notifications are the
// case it exists for, and #81 adds the second.
//
// STATE IS CARRIED BY THE FILL, NOT BY OPACITY
// --------------------------------------------
// On is the chalk track with the ground-coloured thumb — the same "selected is
// chalk" rule the `option` recipe uses, so a screen of controls reads one way.
// Off is the panel ramp. Disabled drops the fill and keeps the thumb legible,
// for the reason `button` gives: at `opacity-40` a control reads as *broken*
// rather than as unavailable.
//
// The visible track is 28px; the hit area is 44px, drawn by a pseudo-element so
// the control keeps the touch floor without growing to the timer's size.
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from '$lib/utils';

export function Switch({
	checked,
	onCheckedChange,
	disabled,
	labelledBy,
	className,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	/** The id of the text that names this switch. A switch carries no label of
	 *  its own, so the row it sits in has to say what it switches. */
	labelledBy: string;
	className?: string;
}) {
	return (
		<BaseSwitch.Root
			checked={checked}
			onCheckedChange={onCheckedChange}
			disabled={disabled}
			aria-labelledby={labelledBy}
			className={cn(
				'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line bg-panel-3 p-0.5 transition-colors',
				"before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
				'hover:border-line-soft',
				'data-[checked]:border-chalk data-[checked]:bg-chalk',
				'data-[disabled]:border-line-soft data-[disabled]:bg-transparent',
				className,
			)}
		>
			<BaseSwitch.Thumb className="block size-5 rounded-full bg-ink-faint transition-transform duration-150 data-[checked]:translate-x-5 data-[checked]:bg-bg data-[disabled]:bg-ink-faint" />
		</BaseSwitch.Root>
	);
}

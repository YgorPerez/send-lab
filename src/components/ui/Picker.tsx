// One select, used everywhere a value is chosen from a list: the variant
// picker, the add-exercise control, and the per-set grip.
//
// Base UI rather than a native `<select>` because the three uses want the same
// visual weight and the same 13px label, and a native control on Android is
// styled by the OS. The trade is a portalled popup on a screen that is already
// dense — mitigated by `alignItemWithTrigger={false}`, which keeps the popup
// below the trigger instead of jumping the selected row under the finger.
import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import { cn } from '$lib/utils';

export interface PickerOption {
	value: string;
	label: string;
}

export function Picker({
	value,
	options,
	onChange,
	placeholder,
	ariaLabel,
	className,
}: {
	value: string | null;
	options: PickerOption[];
	onChange: (value: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	className?: string;
}) {
	const labelOf = (v: unknown) => options.find((o) => o.value === v)?.label ?? placeholder ?? '—';
	return (
		<Select.Root
			value={value}
			onValueChange={(v: unknown) => {
				if (typeof v === 'string') onChange(v);
			}}
		>
			<Select.Trigger
				aria-label={ariaLabel}
				className={cn(
					'flex h-9 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-line bg-panel-2 px-2 text-left text-[13px] text-ink-dim transition-colors active:bg-panel-3',
					className,
				)}
			>
				<Select.Value className="min-w-0 truncate">{labelOf}</Select.Value>
				<Select.Icon className="shrink-0 text-ink-faint">
					<ChevronDown size={14} />
				</Select.Icon>
			</Select.Trigger>
			<Select.Portal>
				<Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-40">
					<Select.Popup className="max-h-[50dvh] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-line bg-panel-3 p-1 shadow-xl shadow-black/40">
						{options.map((o) => (
							<Select.Item
								key={o.value}
								value={o.value}
								// 40px rows, not the 28px a desktop select would use: this is
								// picked mid-set, one-handed. Not `button`'s `touch` size —
								// a list of 48px rows puts fewer than half the grips on screen
								// at once, which costs more than the extra 8px buys.
								className="min-h-10 cursor-default content-center rounded px-2 py-2 text-[13px] text-ink-dim data-[highlighted]:bg-panel-2 data-[selected]:text-chalk"
							>
								<Select.ItemText>{o.label}</Select.ItemText>
							</Select.Item>
						))}
					</Select.Popup>
				</Select.Positioner>
			</Select.Portal>
		</Select.Root>
	);
}

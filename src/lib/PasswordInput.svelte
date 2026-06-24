<script lang="ts">
import EyeIcon from '@lucide/svelte/icons/eye';
import EyeOffIcon from '@lucide/svelte/icons/eye-off';
import type { HTMLInputAttributes } from 'svelte/elements';
import { Input } from '$lib/components/ui/input';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils';

// A password field with a show/hide eye toggle. Forwards any input attribute
// (autocomplete, required, placeholder, …) to the underlying Input.
type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & { value?: string };
let { value = $bindable(''), class: className, ...rest }: Props = $props();

let show = $state(false);
</script>

<div class="relative">
	<Input {...rest} type={show ? 'text' : 'password'} bind:value class={cn('pr-10', className)} />
	<button
		type="button"
		aria-label={show ? m.pw_hide() : m.pw_show()}
		aria-pressed={show}
		tabindex="-1"
		class="absolute inset-y-0 right-0 flex items-center px-3 text-ink-faint transition hover:text-ink"
		onclick={() => (show = !show)}
	>
		{#if show}<EyeOffIcon class="size-4" />{:else}<EyeIcon class="size-4" />{/if}
	</button>
</div>

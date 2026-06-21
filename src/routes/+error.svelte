<script lang="ts">
import { page } from '$app/state';
import { Button } from '$lib/components/ui/button';
import * as m from '$lib/paraglide/messages';
import SectionHeading from '$lib/SectionHeading.svelte';
</script>

<section class="animate-in fade-in duration-300">
	<SectionHeading title={m.sec_error()} />
	<div class="rounded-xl border border-dashed border-line px-5 py-[46px] text-center">
		<p class="text-[34px] font-black text-chalk">{page.status}</p>
		<p class="mt-2 text-ink-dim">{page.error?.message ?? m.error_generic()}</p>
		<Button href="/" variant="outline" class="mt-[18px]">{m.error_back()}</Button>
	</div>
</section>

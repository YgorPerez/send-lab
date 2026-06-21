<script lang="ts">
interface Props {
	title: string;
}
let { title }: Props = $props();
</script>

<h2
	class="mt-1.5 mb-[18px] flex items-center gap-3 font-mono text-[13px] tracking-[0.16em] text-ink-faint uppercase after:h-px after:flex-1 after:bg-line after:content-['']"
>
	{title}
</h2>

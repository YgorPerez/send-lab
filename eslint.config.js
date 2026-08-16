// A deliberately minimal ESLint: `react-hooks/rules-of-hooks` and nothing else.
//
// Biome is the fast inner loop and already runs `useExhaustiveDependencies` and
// `useHookAtTopLevel` (its React domain auto-enables both). This third pass
// exists for one rule, and the reasoning is in issue #20: a rules-of-hooks
// violation is a *runtime crash, not a smell*, and Biome's equivalent needs
// whole-program knowledge of what counts as a component. This is the one rule
// worth having the canonical implementation of.
//
// `exhaustive-deps` stays off here — Biome owns it, and running both doubles the
// noise for one signal. The parser is `@typescript-eslint/parser` alone rather
// than the `typescript-eslint` meta package: no type-aware linting is wanted
// here, only the ability to parse `.ts`/`.tsx` at all.
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
	{
		ignores: [
			'dist/**',
			'.output/**',
			'.tanstack/**',
			'node_modules/**',
			'src/lib/paraglide/**',
			'src/routeTree.gen.ts',
		],
	},
	{
		files: ['src/**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: { 'react-hooks': reactHooks },
		rules: {
			'react-hooks/rules-of-hooks': 'error',
		},
	},
];

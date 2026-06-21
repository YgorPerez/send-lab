import { createAuthClient } from 'better-auth/svelte';

// No baseURL → uses the current origin (works in dev and production).
export const authClient = createAuthClient();

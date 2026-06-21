// Client-rendered app on a Node server: keep SSR off (data + auth resolve on the
// client via the API), and don't prerender — the auth/data routes are dynamic.
export const ssr = false;
export const prerender = false;

// The real "server-only" package throws outside a React Server environment.
// Vitest isn't one, so tests import this empty module instead (see vitest.config.mts).
export {};

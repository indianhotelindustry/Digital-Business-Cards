// ============================================================================
// DSBC RUNTIME FLAGS (Directive 24 Phase 2)
// ============================================================================
// Demo personas, the persona switcher and the legacy in-browser security test
// runner exist only in DEVELOPMENT. `import.meta.env.DEV` is true under the
// Vite dev server and statically false in `vite build`, so these features are
// compiled out of production bundles rather than merely hidden.
//
// Full DEVELOPMENT / STAGING / PRODUCTION configuration arrives in Phase 12;
// until then this is the only switch for demo-only behaviour.

export const DEMO_FEATURES_ENABLED: boolean = import.meta.env?.DEV === true;

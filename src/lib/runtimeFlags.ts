// ============================================================================
// DSBC RUNTIME FLAGS (Directive 24 Phase 2, Directive 27 Phase 2)
// ============================================================================
// Demo personas, the persona switcher, sample records and the legacy in-browser
// security test runner exist only in DEVELOPMENT. Two conditions must BOTH hold:
//   * `import.meta.env.DEV` — true under the Vite dev server and statically
//     false in `vite build`, so these features are compiled out of every built
//     bundle rather than merely hidden; and
//   * the deployment target allows them (config/environments.json: only the
//     emulator-backed development target does; production never can).

import { ENVIRONMENT_ERROR, currentEnvironment } from './environment';

const targetAllowsDemo = !ENVIRONMENT_ERROR && currentEnvironment().demoDataAllowed && currentEnvironment().mockPersonasAllowed;

export const DEMO_FEATURES_ENABLED: boolean = import.meta.env?.DEV === true && targetAllowsDemo;

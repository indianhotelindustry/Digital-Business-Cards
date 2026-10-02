// ============================================================================
// DSBC environment configuration view (Directive 20, rewritten in Directive 27)
// ============================================================================
// Read-only view of the deployment target this bundle was built for
// (src/lib/environment.ts, config/environments.json). There is deliberately no
// setter: the environment cannot be switched from the browser, and nothing is
// inferred from the hostname or read from localStorage.

import { currentEnvironment, type AppEnvironment } from '../lib/environment';

export type { AppEnvironment };

export interface EnvironmentConfig {
  environment: AppEnvironment;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  firebaseProjectId: string;
  /** "(default)" only for the emulator target. */
  firestoreDatabaseId: string;
  storageBucket: string;
  authDomain: string;
  functionsRegion: string;
  usesEmulators: boolean;
  hostingSite: string | null;
  publicOrigin: string | null;
  enableDemoData: boolean;
  enableMockAuthPersonas: boolean;
  /** Online payments are switched off in every environment until a launch directive enables them. */
  paymentGatewayMode: 'disabled' | 'test' | 'live';
}

class EnvironmentService {
  public getEnvironment(): AppEnvironment {
    return currentEnvironment().environment;
  }

  public getConfig(): EnvironmentConfig {
    const env = currentEnvironment();
    return {
      environment: env.environment,
      isProduction: env.isProduction,
      isStaging: env.isStaging,
      isDevelopment: env.isDevelopment,
      firebaseProjectId: env.firebase.projectId,
      firestoreDatabaseId: env.firestoreDatabaseId || '(default)',
      storageBucket: env.firebase.storageBucket,
      authDomain: env.firebase.authDomain,
      functionsRegion: env.functionsRegion,
      usesEmulators: env.useEmulators,
      hostingSite: env.hostingSite,
      publicOrigin: env.publicOrigin,
      enableDemoData: env.demoDataAllowed,
      enableMockAuthPersonas: env.mockPersonasAllowed,
      paymentGatewayMode: env.payments,
    };
  }
}

export const environmentConfig = new EnvironmentService();

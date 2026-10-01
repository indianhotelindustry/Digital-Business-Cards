// ============================================================================
// DSBC PRODUCTION ENVIRONMENT SEPARATION & CONFIGURATION (Directive 20)
// ============================================================================

export type AppEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

export interface EnvironmentConfig {
  environment: AppEnvironment;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  version: string;
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  authDomain: string;
  enableDemoData: boolean;
  enableMockAuthPersonas: boolean;
  paymentGatewayMode: 'test' | 'live';
  razorpayKeyId: string;
  allowSelfRegistration: boolean;
  allowPublicPublishing: boolean;
  maintenanceMode: boolean;
  storageNamespace: string;
  supportEmail: string;
}

const STORAGE_KEY = 'dsbc_env_override_v2';

class EnvironmentService {
  private currentEnv: AppEnvironment;
  private overrideEnv: AppEnvironment | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    // Detect environment from build / hostname / storage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === 'DEVELOPMENT' || saved === 'STAGING' || saved === 'PRODUCTION')) {
      this.overrideEnv = saved as AppEnvironment;
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isDevUrl = host.includes('ais-dev');
    const isStagingUrl = host.includes('ais-pre') || host.includes('staging');

    if (this.overrideEnv) {
      this.currentEnv = this.overrideEnv;
    } else if (isLocal || isDevUrl) {
      this.currentEnv = 'DEVELOPMENT';
    } else if (isStagingUrl) {
      this.currentEnv = 'STAGING';
    } else {
      this.currentEnv = 'PRODUCTION';
    }
  }

  public getEnvironment(): AppEnvironment {
    return this.currentEnv;
  }

  public getConfig(): EnvironmentConfig {
    const env = this.currentEnv;
    const isProd = env === 'PRODUCTION';
    const isStage = env === 'STAGING';
    const isDev = env === 'DEVELOPMENT';

    return {
      environment: env,
      isProduction: isProd,
      isStaging: isStage,
      isDevelopment: isDev,
      version: '2.6.0-prod',
      firebaseProjectId: isProd ? 'dsbc-production' : 'v-nexus-lite',
      firestoreDatabaseId: isProd ? '(default)' : 'ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5',
      storageBucket: isProd ? 'dsbc-production.firebasestorage.app' : 'v-nexus-lite.firebasestorage.app',
      authDomain: isProd ? 'auth.dsbc.app' : 'v-nexus-lite.firebaseapp.com',
      // CRITICAL: Demo data is strictly disabled in production!
      enableDemoData: !isProd,
      enableMockAuthPersonas: !isProd,
      paymentGatewayMode: isProd ? 'live' : 'test',
      razorpayKeyId: isProd ? 'rzp_live_DSBCprod2026' : 'rzp_test_DSBCdev2026',
      allowSelfRegistration: true,
      allowPublicPublishing: true,
      maintenanceMode: false,
      storageNamespace: `dsbc_${env.toLowerCase()}_v1`,
      supportEmail: 'support@dsbc.example.com',
    };
  }

  public setEnvironment(env: AppEnvironment): void {
    this.currentEnv = env;
    this.overrideEnv = env;
    localStorage.setItem(STORAGE_KEY, env);
    this.notify();
  }

  public resetToDefault(): void {
    this.overrideEnv = null;
    localStorage.removeItem(STORAGE_KEY);
    const host = window.location.hostname;
    if (host === 'localhost' || host.includes('ais-dev')) {
      this.currentEnv = 'DEVELOPMENT';
    } else if (host.includes('ais-pre')) {
      this.currentEnv = 'STAGING';
    } else {
      this.currentEnv = 'PRODUCTION';
    }
    this.notify();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Env listener error:', e);
      }
    });
  }
}

export const environmentConfig = new EnvironmentService();

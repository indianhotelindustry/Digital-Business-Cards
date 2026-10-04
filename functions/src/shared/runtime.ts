// Runtime options for every function in this codebase.
// firebase-functions fixes an endpoint's region when onCall()/onDocument*()
// runs, so these options must be set before ANY module defines a function.
// Every module that defines functions imports this one first (Directive 31:
// the public resolver used to be defined before index.ts set the region and
// shipped to us-central1 while the browser called asia-south1).
import { setGlobalOptions } from 'firebase-functions/v2';
import { assertBackendEnvironment } from './environment';

// Directive 27: refuse to load (deploy discovery and cold start fail) unless
// project, database, region, payments and public origin match the registry.
export const BACKEND_ENV = assertBackendEnvironment();

setGlobalOptions({ region: BACKEND_ENV.region!, maxInstances: 10 });

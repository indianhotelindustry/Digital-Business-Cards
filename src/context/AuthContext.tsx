import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile, Company, UserRole } from '../types';
import { getUserProfile, logout as authLogout } from '../services/authService';
import { getCompanyById } from '../services/companyService';
import { DEMO_USERS } from '../services/seedService';
import { DEMO_FEATURES_ENABLED } from '../lib/runtimeFlags';
import { deriveEffectiveRole, hasVerifiedOwnerClaim } from '../lib/authority';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  activeCompany: Company | null;
  loading: boolean;
  role: UserRole | null;
  isAppOwner: boolean;
  isCompanyAdmin: boolean;
  isEmployee: boolean;
  isDemoMode: boolean;
  authMethod: 'DEMO_PERSONA' | 'FIREBASE_AUTH';
  refreshUserData: () => Promise<void>;
  switchDemoPersona: (personaKey: keyof typeof DEMO_USERS) => Promise<void>;
  logoutUser: () => Promise<void>;
  setCustomUserProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Server-set custom claim (scripts/admin/setAppOwner.ts) on a verified email.
  const [ownerClaimVerified, setOwnerClaimVerified] = useState<boolean>(false);

  // Load profile & tenant company
  const loadProfileAndCompany = async (profile: UserProfile | null) => {
    setUserProfile(profile);
    if (profile?.companyId) {
      try {
        const comp = await getCompanyById(profile.companyId);
        setActiveCompany(comp);
      } catch (err) {
        console.error('Error fetching tenant company:', err);
        setActiveCompany(null);
      }
    } else {
      setActiveCompany(null);
    }
  };

  // Reload the authoritative profile from Firestore for the signed-in user.
  const refreshUserData = async () => {
    const uid = auth.currentUser?.uid || userProfile?.id;
    if (uid) {
      const updated = await getUserProfile(uid);
      if (updated) {
        await loadProfileAndCompany(updated);
      }
    }
  };

  // Switch demo persona (DEVELOPMENT only)
  const switchDemoPersona = async (personaKey: keyof typeof DEMO_USERS) => {
    if (!DEMO_FEATURES_ENABLED) {
      console.warn('Demo personas are disabled outside DEVELOPMENT.');
      return;
    }
    setLoading(true);
    const target = DEMO_USERS[personaKey];
    try {
      localStorage.setItem('dbc_active_demo_persona', personaKey);
      await loadProfileAndCompany(target as UserProfile);
    } catch (err) {
      console.error('Error switching demo persona:', err);
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    localStorage.removeItem('dbc_active_demo_persona');
    setUserProfile(null);
    setActiveCompany(null);
    try {
      await authLogout();
    } catch (e) {
      // ignore
    }
  };

  // Client-side profile injection is a demo facility only (DEVELOPMENT).
  const setCustomUserProfile = (profile: UserProfile) => {
    if (!DEMO_FEATURES_ENABLED) {
      console.warn('setCustomUserProfile is disabled outside DEVELOPMENT.');
      return;
    }
    loadProfileAndCompany(profile);
  };

  useEffect(() => {
    let isMounted = true;

    // Directive 24 Phase 3: the client never seeds the database. Demo data is
    // created only by `npm run seed` (scripts/admin/seedDemoData.ts, Admin SDK,
    // emulator/non-production only).
    async function init() {
      try {
        if (!DEMO_FEATURES_ENABLED) return;

        // DEVELOPMENT: restore the last demo persona, defaulting to Acme admin
        // so the dev workspace opens on a populated dashboard.
        const storedPersona = localStorage.getItem('dbc_active_demo_persona') as keyof typeof DEMO_USERS | null;
        const persona = storedPersona && DEMO_USERS[storedPersona] ? storedPersona : 'companyAdminAcme';
        if (isMounted && !auth.currentUser) {
          await loadProfileAndCompany(DEMO_USERS[persona] as UserProfile);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);
      if (firebaseUser) {
        // Real Firebase session: the Firestore profile and the ID-token claims
        // are the only sources of identity and platform authority.
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          if (isMounted) setOwnerClaimVerified(hasVerifiedOwnerClaim(tokenResult.claims, firebaseUser.emailVerified));
        } catch (err) {
          console.error('Unable to read ID token claims:', err);
          if (isMounted) setOwnerClaimVerified(false);
        }
        const prof = await getUserProfile(firebaseUser.uid);
        if (isMounted) {
          await loadProfileAndCompany(prof);
        }
      } else if (isMounted) {
        setOwnerClaimVerified(false);
        if (!DEMO_FEATURES_ENABLED) {
          setUserProfile(null);
          setActiveCompany(null);
        }
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const role = deriveEffectiveRole({
    profileRole: userProfile?.role,
    isFirebaseSession: !!currentUser,
    hasVerifiedOwnerClaim: ownerClaimVerified,
    demoFeaturesEnabled: DEMO_FEATURES_ENABLED,
  });
  const isAppOwner = role === 'app_owner';
  const isCompanyAdmin = role === 'company_admin';
  const isEmployee = role === 'employee';
  const isDemoMode = !currentUser && !!userProfile;
  const authMethod: 'DEMO_PERSONA' | 'FIREBASE_AUTH' = currentUser ? 'FIREBASE_AUTH' : 'DEMO_PERSONA';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        activeCompany,
        loading,
        role,
        isAppOwner,
        isCompanyAdmin,
        isEmployee,
        isDemoMode,
        authMethod,
        refreshUserData,
        switchDemoPersona,
        logoutUser,
        setCustomUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

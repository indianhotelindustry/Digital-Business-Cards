import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { UserProfile, Company, UserRole } from '../types';
import { getUserProfile, logout as authLogout } from '../services/authService';
import { getCompanyById } from '../services/companyService';
import { DEMO_USERS, isDatabaseInitialized, seedInitialSaaSData } from '../services/seedService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

  const refreshUserData = async () => {
    if (userProfile?.id) {
      const updated = await getUserProfile(userProfile.id);
      if (updated) {
        await loadProfileAndCompany(updated);
      }
    }
  };

  // Switch demo persona
  const switchDemoPersona = async (personaKey: keyof typeof DEMO_USERS) => {
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

  const setCustomUserProfile = (profile: UserProfile) => {
    loadProfileAndCompany(profile);
  };

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        // Auto-seed if first time running
        const initialized = await isDatabaseInitialized();
        if (!initialized) {
          console.log('Database empty, initializing multi-tenant starter data...');
          await seedInitialSaaSData();
        }

        // Check if demo persona stored
        const storedPersona = localStorage.getItem('dbc_active_demo_persona') as keyof typeof DEMO_USERS | null;
        if (storedPersona && DEMO_USERS[storedPersona]) {
          if (isMounted) {
            await loadProfileAndCompany(DEMO_USERS[storedPersona] as UserProfile);
            setLoading(false);
            return;
          }
        }

        // Default to Acme Company Admin demo so user immediately lands on a live operational dashboard
        if (isMounted) {
          const defaultDemo = DEMO_USERS.companyAdminAcme;
          await loadProfileAndCompany(defaultDemo as UserProfile);
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
        // If real logged in Firebase user
        const prof = await getUserProfile(firebaseUser.uid);
        if (prof && isMounted) {
          await loadProfileAndCompany(prof);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const role = userProfile?.role || null;
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

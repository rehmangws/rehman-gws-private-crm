import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types/crm';
import { auth, isFirebaseConfigured } from '../services/firebaseConfig';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_ALLOWLIST = [
  'rehmanglobal.contact@gmail.com',
  'admin@rehmangws.com',
];

const LOCAL_SESSION_KEY = 'rehman_gws_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
        if (fbUser && fbUser.email) {
          const emailLower = fbUser.email.toLowerCase();
          const role = ADMIN_ALLOWLIST.includes(emailLower) ? 'admin' : 'staff';
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || 'Rehman GWS Admin',
            role,
            lastLogin: new Date().toISOString(),
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Restore local private session if available
      try {
        const stored = localStorage.getItem(LOCAL_SESSION_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          // Pre-authenticate the primary administrator for frictionless local development & instant testing
          const defaultAdmin: UserProfile = {
            uid: 'admin-rehman-001',
            email: 'rehmanglobal.contact@gmail.com',
            displayName: 'Rehman GWS Operations Admin',
            role: 'admin',
            lastLogin: new Date().toISOString(),
          };
          setUser(defaultAdmin);
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(defaultAdmin));
        }
      } catch (e) {
        console.error('Session restoration failed:', e);
      }
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    const emailLower = email.trim().toLowerCase();

    // Check allowlist
    const isAllowed = ADMIN_ALLOWLIST.includes(emailLower);
    if (!isAllowed) {
      setLoading(false);
      return {
        success: false,
        error: 'Access Restricted: This is a private CRM. Your email is not authorized on the REHMAN GWS allowlist.',
      };
    }

    if (isFirebaseConfigured && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const fbUser = cred.user;
        const uProfile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || email,
          displayName: fbUser.displayName || 'Operations Admin',
          role: 'admin',
          lastLogin: new Date().toISOString(),
        };
        setUser(uProfile);
        setLoading(false);
        return { success: true };
      } catch (err: any) {
        setLoading(false);
        return { success: false, error: err.message || 'Authentication failed' };
      }
    } else {
      // Local private admin credential check
      if (pass.length < 6) {
        setLoading(false);
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      const uProfile: UserProfile = {
        uid: `admin-${Date.now()}`,
        email: emailLower,
        displayName: 'Rehman GWS Operations Admin',
        role: 'admin',
        lastLogin: new Date().toISOString(),
      };
      setUser(uProfile);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(uProfile));
      setLoading(false);
      return { success: true };
    }
  };

  const logout = async (): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin bootstrapped email as specified in system metadata
const BOOTSTRAP_ADMIN_EMAIL = 'mt12a6@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setActiveRole('student');
        setIsLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', currentUser.uid);

      try {
        const docSnap = await getDoc(userDocRef);
        let userProfile: UserProfile;

        if (!docSnap.exists()) {
          // Initial profile registration
          const isBootstrapAdmin = currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
          const initialRole: UserRole = isBootstrapAdmin ? 'admin' : 'student';

          userProfile = {
            id: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Người dùng'),
            photoURL: currentUser.photoURL || undefined,
            role: initialRole,
            status: 'active',
            createdAt: new Date().toISOString()
          };

          await setDoc(userDocRef, userProfile);
        } else {
          userProfile = docSnap.data() as UserProfile;
          // Ensure bootstrap admin always keeps admin rights
          if (currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && userProfile.role !== 'admin') {
            userProfile.role = 'admin';
            await setDoc(userDocRef, { role: 'admin' }, { merge: true });
          }
        }

        setProfile(userProfile);
        setActiveRole(userProfile.role);
      } catch (err) {
        console.error('Error fetching/creating user profile:', err);
        // Do not crash, still set basic profile
        const isBootstrapAdmin = currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        setProfile({
          id: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Người dùng',
          role: isBootstrapAdmin ? 'admin' : 'student',
          status: 'active',
          createdAt: new Date().toISOString()
        });
        setActiveRole(isBootstrapAdmin ? 'admin' : 'student');
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to profile updates (e.g., if admin changes role or deactivates account)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
        // If activeRole is not overridden by admin simulation, keep it in sync
        if (data.role !== 'admin') {
          setActiveRole(data.role);
        }
      }
    }, (err) => {
      console.warn('Profile snapshot listener warning:', err.message);
    });
    return () => unsub();
  }, [user]);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google Sign-In failed:', err);
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCredentials = async (identifier: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const { loginWithUsernamePassword } = await import('../services/db');
      const matchedProfile = await loginWithUsernamePassword(identifier, password);
      if (!matchedProfile) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
        return false;
      }

      setProfile(matchedProfile);
      setActiveRole(matchedProfile.role);
      return true;
    } catch (err: unknown) {
      console.error('Credential sign-in failed:', err);
      setError('Đăng nhập tài khoản thất bại.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setProfile(null);
      setUser(null);
      setActiveRole('student');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher' || isAdmin;
  const isStudent = profile?.role === 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        activeRole,
        setActiveRole,
        isLoading,
        loginWithGoogle,
        loginWithCredentials,
        logout,
        isAdmin,
        isTeacher,
        isStudent,
        error,
        clearError: () => setError(null)
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

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
import { ShieldAlert } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<boolean>;
  registerStudent: (data: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    className?: string;
  }) => Promise<boolean>;
  loginAsDemoRole: (role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin bootstrapped emails
const BOOTSTRAP_ADMIN_EMAILS = ['mt12a6@gmail.com', 'daiso2014@gmail.com'];
const isSuperAdminEmail = (email?: string | null) => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return BOOTSTRAP_ADMIN_EMAILS.some(adm => adm.toLowerCase() === clean);
};

const STORAGE_CREDENTIAL_SESSION = 'edutest_active_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kickedModal, setKickedModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Check if there is an active username/password credential session
        try {
          const cachedSession = localStorage.getItem(STORAGE_CREDENTIAL_SESSION);
          if (cachedSession) {
            const parsed = JSON.parse(cachedSession) as UserProfile;
            setProfile(parsed);
            setActiveRole(parsed.role);
            setUser({
              uid: parsed.id,
              email: parsed.email,
              displayName: parsed.displayName,
              photoURL: parsed.photoURL
            } as any);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Error reading cached session:', e);
        }

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
          const isBootstrapAdmin = isSuperAdminEmail(currentUser.email);
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
          if (isSuperAdminEmail(currentUser.email) && userProfile.role !== 'admin') {
            userProfile.role = 'admin';
            await setDoc(userDocRef, { role: 'admin' }, { merge: true });
          }
        }

        setProfile(userProfile);
        setActiveRole(userProfile.role);
      } catch (err) {
        console.error('Error fetching/creating user profile:', err);
        // Do not crash, still set basic profile
        const isBootstrapAdmin = isSuperAdminEmail(currentUser.email);
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

  const STORAGE_SESSION_TOKEN_KEY = 'edutest_session_token';

  // Listen to profile updates & Enforce single active session ONLY for students
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        
        // Single Active Session check:
        // APPLIES ONLY TO STUDENTS (Học sinh) per user instruction:
        // "chỉ trường hợp học sinh đăng nhập 1 lúc hai thiết bị thì chỉ ghi nhận là thiết bị sau được đăng nhập và thoát thiết bị đầu."
        if (data.role === 'student') {
          const remoteSession = data.currentSessionId;
          const localSession = localStorage.getItem(STORAGE_SESSION_TOKEN_KEY);
          if (remoteSession && localSession && remoteSession !== localSession) {
            setKickedModal(true);
            logout();
            return;
          }
        }

        setProfile(data);
        setActiveRole(data.role);
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
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, sessionToken);
        try {
          const { setDoc, doc } = await import('firebase/firestore');
          await setDoc(doc(db, 'users', cred.user.uid), { currentSessionId: sessionToken }, { merge: true });
        } catch (e) {
          console.warn('Google sign-in session push note:', e);
        }
      }
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
      const { loginWithUsernamePassword, sanitizeForFirestore } = await import('../services/db');
      const matchedProfile = await loginWithUsernamePassword(identifier, password);
      if (!matchedProfile) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
        return false;
      }

      // Generate a unique session token for this device login
      const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, sessionToken);

      const updatedProfile = { ...matchedProfile, currentSessionId: sessionToken };
      setProfile(updatedProfile);
      setActiveRole(matchedProfile.role);
      setUser({
        uid: matchedProfile.id,
        email: matchedProfile.email,
        displayName: matchedProfile.displayName,
        photoURL: matchedProfile.photoURL
      } as any);
      localStorage.setItem(STORAGE_CREDENTIAL_SESSION, JSON.stringify(updatedProfile));

      // Push session token to Firestore so previous device will be kicked if student
      try {
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', matchedProfile.id), sanitizeForFirestore(updatedProfile), { merge: true });
      } catch (e) {
        console.warn('Update session ID note:', e);
      }

      return true;
    } catch (err: unknown) {
      console.error('Credential sign-in failed:', err);
      setError('Đăng nhập tài khoản thất bại.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Self-Registration for Students (Người dùng tự đăng ký với vai trò Học sinh)
  const registerStudent = async (data: {
    username: string;
    displayName: string;
    email: string;
    password: string;
    className?: string;
  }): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const { createUserProfile, sanitizeForFirestore } = await import('../services/db');
      const newProfile = await createUserProfile({
        username: data.username.trim(),
        displayName: data.displayName.trim(),
        email: data.email.trim() || `${data.username.trim().toLowerCase()}@edutest.edu.vn`,
        password: data.password || '123456',
        role: 'student',
        status: 'active',
        className: data.className || '10A1',
        classIds: [data.className || '10A1']
      });

      const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, sessionToken);

      const updated = { ...newProfile, currentSessionId: sessionToken };
      setProfile(updated);
      setActiveRole('student');
      setUser({
        uid: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        photoURL: updated.photoURL
      } as any);
      localStorage.setItem(STORAGE_CREDENTIAL_SESSION, JSON.stringify(updated));

      try {
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', updated.id), sanitizeForFirestore(updated), { merge: true });
      } catch (e) {
        console.warn('Register firestore sync note:', e);
      }

      return true;
    } catch (err: unknown) {
      console.error('Student registration error:', err);
      const msg = err instanceof Error ? err.message : 'Đăng ký tài khoản không thành công';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 1-click test role login fallback (if needed)
  const loginAsDemoRole = async (targetRole: UserRole): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const { getDefaultUsers, sanitizeForFirestore } = await import('../services/db');
      const defaultUsers = getDefaultUsers();
      const matched = defaultUsers.find(u => u.role === targetRole) || defaultUsers[0];

      const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, sessionToken);

      const updatedProfile = { ...matched, currentSessionId: sessionToken };
      setProfile(updatedProfile);
      setActiveRole(matched.role);
      setUser({
        uid: matched.id,
        email: matched.email,
        displayName: matched.displayName,
        photoURL: matched.photoURL
      } as any);
      localStorage.setItem(STORAGE_CREDENTIAL_SESSION, JSON.stringify(updatedProfile));

      try {
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', matched.id), sanitizeForFirestore(updatedProfile), { merge: true });
      } catch (e) {
        console.warn('Demo session firestore sync note:', e);
      }
      return true;
    } catch (err) {
      console.error('loginAsDemoRole failed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem(STORAGE_CREDENTIAL_SESSION);
      localStorage.removeItem(STORAGE_SESSION_TOKEN_KEY);
      await firebaseSignOut(auth);
      setProfile(null);
      setUser(null);
      setActiveRole('student');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };


  const isAdmin = profile?.role === 'admin' || activeRole === 'admin';
  const isTeacher = profile?.role === 'teacher' || isAdmin || activeRole === 'teacher';
  const isStudent = activeRole === 'student';

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
        registerStudent,
        loginAsDemoRole,
        logout,
        isAdmin,
        isTeacher,
        isStudent,
        error,
        clearError: () => setError(null)
      }}
    >
      {children}

      {/* Security alert modal for single active session restriction */}
      {kickedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Phiên làm việc đã bị ngắt</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tài khoản của bạn vừa được đăng nhập trên một thiết bị hoặc trình duyệt khác. Để đảm bảo an toàn và tính công bằng trong thi cử (hạn chế chỉ 1 tài khoản đăng nhập ở 1 thời điểm), phiên làm việc này đã được đăng xuất.
            </p>
            <button
              onClick={() => setKickedModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
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

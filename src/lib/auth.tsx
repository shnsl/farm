import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UserProfile } from '../types'
import { auth, db } from './firebase'

/** Arka planda Auth için sabit hesap; ekranda e-posta gösterilmez. */
export const FARM_AUTH_EMAIL =
  import.meta.env.VITE_FARM_AUTH_EMAIL?.trim() ||
  `owner@${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'farm'}.firebaseapp.com`

export const DEFAULT_PIN = '222222'

export const pinSchema = {
  test(value: string): value is string {
    return /^\d{6}$/.test(value)
  },
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  farmId: string | null
  loading: boolean
  error: string | null
  loginWithPin: (pin: string) => Promise<void>
  changePin: (currentPin: string, nextPin: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Sekme yenilemede kalır; uygulama/sekme kapanınca silinir. */
const SESSION_UNLOCK_KEY = 'farm-session-unlocked'

function markSessionUnlocked() {
  sessionStorage.setItem(SESSION_UNLOCK_KEY, '1')
}

function clearSessionUnlock() {
  sessionStorage.removeItem(SESSION_UNLOCK_KEY)
}

function isSessionUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_UNLOCK_KEY) === '1'
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return new Date().toISOString()
}

function authErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code: string }).code)
  }
  return null
}

async function ensureUserFarm(user: User, farmName = 'Çiftliğim'): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid)
  const existing = await getDoc(userRef)

  if (existing.exists()) {
    const data = existing.data()
    return {
      email: data.email as string,
      displayName: data.displayName as string | undefined,
      farmId: data.farmId as string,
      createdAt: toIso(data.createdAt),
    }
  }

  const farmRef = doc(db, 'farms', user.uid)
  const farmSnap = await getDoc(farmRef)

  if (!farmSnap.exists()) {
    await setDoc(farmRef, {
      name: farmName,
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
    })
  }

  const profile: UserProfile = {
    email: user.email ?? FARM_AUTH_EMAIL,
    farmId: farmRef.id,
    createdAt: new Date().toISOString(),
  }

  await setDoc(userRef, {
    email: profile.email,
    farmId: profile.farmId,
    createdAt: serverTimestamp(),
  })

  await setDoc(
    doc(db, 'farms', farmRef.id, 'config', 'access'),
    {
      method: 'pin',
      pinLength: 6,
      defaultPinHint: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )

  return profile
}

async function markPinUpdated(farmId: string) {
  await setDoc(
    doc(db, 'farms', farmId, 'config', 'access'),
    {
      method: 'pin',
      pinLength: 6,
      defaultPinHint: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true)
      setError(null)
      try {
        if (!nextUser) {
          setUser(null)
          setProfile(null)
          return
        }

        // Firebase oturumu kalıcı; uygulama kapanınca session bayrağı gider → PIN iste
        if (!isSessionUnlocked()) {
          clearSessionUnlock()
          await signOut(auth)
          setUser(null)
          setProfile(null)
          return
        }

        setUser(nextUser)
        const nextProfile = await ensureUserFarm(nextUser)
        setProfile(nextProfile)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Oturum yüklenemedi')
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const loginWithPin = useCallback(async (pin: string) => {
    setError(null)
    if (!pinSchema.test(pin)) {
      throw new Error('Şifreyi kontrol et')
    }

    try {
      await signInWithEmailAndPassword(auth, FARM_AUTH_EMAIL, pin)
      markSessionUnlocked()
    } catch (err) {
      const code = authErrorCode(err)
      const missingUser =
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials'

      // İlk kurulum: hesap yoksa yalnızca varsayılan PIN ile oluştur
      if (missingUser && pin === DEFAULT_PIN) {
        try {
          await createUserWithEmailAndPassword(auth, FARM_AUTH_EMAIL, DEFAULT_PIN)
          markSessionUnlocked()
          return
        } catch (createErr) {
          const createCode = authErrorCode(createErr)
          if (createCode === 'auth/email-already-in-use') {
            throw new Error('Şifre hatalı')
          }
          throw createErr
        }
      }

      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials'
      ) {
        throw new Error('Şifre hatalı')
      }

      throw err instanceof Error ? err : new Error('Giriş başarısız')
    }
  }, [])

  const changePin = useCallback(async (currentPin: string, nextPin: string) => {
    setError(null)
    if (!pinSchema.test(currentPin) || !pinSchema.test(nextPin)) {
      throw new Error('Şifreyi kontrol et')
    }
    if (currentPin === nextPin) {
      throw new Error('Yeni şifre eskisiyle aynı olamaz')
    }

    const currentUser = auth.currentUser
    if (!currentUser || !currentUser.email) {
      throw new Error('Oturum bulunamadı')
    }

    const credential = EmailAuthProvider.credential(currentUser.email, currentPin)
    await reauthenticateWithCredential(currentUser, credential)
    await updatePassword(currentUser, nextPin)

    const farmId = currentUser.uid
    await markPinUpdated(farmId)
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    clearSessionUnlock()
    await signOut(auth)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      farmId: profile?.farmId ?? null,
      loading,
      error,
      loginWithPin,
      changePin,
      logout,
      clearError,
    }),
    [user, profile, loading, error, loginWithPin, changePin, logout, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir')
  }
  return ctx
}

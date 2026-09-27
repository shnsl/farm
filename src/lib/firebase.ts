import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value || String(value).startsWith('your-'))
    .map(([key]) => key)

  if (missing.length > 0) {
    console.warn(
      `Firebase yapılandırması eksik: ${missing.join(', ')}. .env dosyasını .env.example üzerinden oluştur.`,
    )
  }
}

assertConfig()

export const app: FirebaseApp = initializeApp(firebaseConfig)
export const auth: Auth = getAuth(app)

/**
 * İş verisinin kaynağı her zaman Cloud Firestore’tur.
 * persistentLocalCache: kısa süreli offline yazıları kuyruğa alır ve
 * tekrar online olunca sunucuya senkronlar; cihazlar arası kaynak Firebase’dir.
 * (Tema/font gibi UI tercihleri localStorage’dadır — iş kaydı değildir.)
 */
function createDb(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch {
    // HMR / ikinci init
    return getFirestore(app)
  }
}

export const db: Firestore = createDb()

void setPersistence(auth, browserLocalPersistence).catch((err: unknown) => {
  console.warn('Auth persistence ayarlanamadı', err)
})

# Tarla Ağaç Takip

Web tabanlı, PWA destekli tarla / ağaç bakım takip uygulaması. Firebase Auth + Firestore ile çalışır.

## Özellikler (Faz 1)

- E-posta/şifre ile giriş ve kayıt
- İlk girişte otomatik `farm` oluşturma (`ownerUid` güvenliği)
- Tarla oluşturma (satır × sütun boyutu)
- Hücre grid’i (`A-12` formatı) ile ağaç ekleme / kaldırma
- Bakım ve sürme standartları config dosyaları
- Offline shell için PWA (manifest + service worker)

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Firebase projesi

1. [Firebase Console](https://console.firebase.google.com/) üzerinden yeni proje oluştur.
2. **Authentication → Sign-in method → Email/Password** etkinleştir.
3. **Firestore Database** oluştur (production mode önerilir; rules’ı aşağıdan deploy edeceksin).
4. **Project settings → Your apps → Web** ile bir app ekle; config değerlerini kopyala.

### 3. Ortam değişkenleri

```bash
cp .env.example .env
```

`.env` içine Firebase web config değerlerini yaz:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> Bu değerler client’ta görünür; asıl güvenlik [firestore.rules](firestore.rules) dosyasındadır.

### 4. Security Rules deploy

Firebase CLI ile:

```bash
npm install -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

Rules özeti: yalnızca `farms/{farmId}.ownerUid == auth.uid` olan kullanıcı okuyup yazabilir.

### 5. Çalıştırma

```bash
npm run dev
```

Tarayıcıda `http://localhost:5173` aç. İlk kullanımda **Hesap oluştur** ile kayıt ol.

Production build + önizleme:

```bash
npm run build
npm run preview
```

## Mobil / GitHub Pages

Push to `main` → GitHub Actions build eder ve yayınlar:

**Adres:** https://shnsl.github.io/farm/

### Bir kez yapılacak ayarlar

1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Repo → **Settings → Secrets and variables → Actions** içine ekle:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Firebase Console → **Authentication → Settings → Authorized domains** listesine ekle: `shnsl.github.io`
4. Firestore Rules’ı bir kez deploy et:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Config dosyaları

Standart tarih / aralıkları buradan düzenlersin:

- [src/config/careStandards.ts](src/config/careStandards.ts) — bakım türleri ve gün aralıkları
- [src/config/plowWindows.ts](src/config/plowWindows.ts) — yıllık sürme pencereleri (`MM-DD`)

Yeni tarlalar oluşturulurken sürme standartları `plowWindows` dosyasından kopyalanır.

## Veri modeli (kısa)

```
users/{uid}
farms/{farmId}
farms/{farmId}/fields/{fieldId}
farms/{farmId}/fields/{fieldId}/trees/{treeId}
```

Hücre kimliği: `A-12` (satır harfi + sütun numarası). Firestore document id ayrı tutulur.

## Sonraki fazlar

- Bakım olayları ve yaklaşan iş listesi
- Sürme kayıtları / yıllık durum
- Offline yazma kuyruğu, bildirimler

# Votely

Votely adalah platform e-voting dengan beberapa bagian aplikasi:

- `votely-web`: web admin/user berbasis Next.js.
- `votely-backend`: API backend berbasis Express dan TypeScript.
- `votely-mobile`: frontend mobile/web ringan berbasis React + Vite.
- `face-recognition`: API Python untuk verifikasi wajah.

## Prasyarat

Pastikan sudah terinstall:

- Node.js 20 atau lebih baru
- npm
- Python 3.11 atau lebih baru
- Docker dan Docker Compose, jika ingin menjalankan semua service dengan Docker
- Database PostgreSQL atau Supabase

## Struktur Project

```text
.
|-- votely-web/          # Aplikasi web Next.js
|-- votely-backend/      # Backend Express + TypeScript
|-- votely-mobile/       # Source frontend Vite yang dipakai root app
|-- face-recognition/    # API face recognition Python
|-- docker-compose.yml   # Konfigurasi Docker semua service
|-- package.json         # Script Vite untuk menjalankan votely-mobile
`-- .env                 # Environment variable bersama
```

## Environment Variable

Buat file `.env` di root project. Contoh isi minimal:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
DIRECT_URL="postgresql://user:password@host:5432/database"

JWT_SECRET="ganti-dengan-secret"
ENCRYPTION_KEY="ganti-dengan-key"

NEXT_PUBLIC_SUPABASE_URL="https://project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="supabase-service-role-key"

NEXT_PUBLIC_THIRDWEB_CLIENT_ID="thirdweb-client-id"
NEXT_PUBLIC_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_RPC_URL="http://127.0.0.1:8545"
SEPOLIA_RPC_URL="https://..."
PRIVATE_KEY="private-key-wallet"

PYTHON_API_URL="http://127.0.0.1:5000"
FACE_RECOGNITION_API_URL="http://127.0.0.1:5000"
BACKEND_PORT=4000
CORS_ORIGIN="http://localhost:3000,http://localhost:5173"
VITE_API_BASE_URL="http://localhost:4000"
```

Sesuaikan value dengan konfigurasi lokal/Supabase/blockchain yang digunakan.

## Cara Menjalankan Secara Manual

### 1. Install dependency

Jalankan dari root project:

```bash
npm install
cd votely-web
npm install
cd ../votely-backend
npm install
cd ..
```

### 2. Generate Prisma Client

Backend menggunakan schema Prisma dari `votely-web/prisma/schema.prisma`.

```bash
cd votely-backend
npm run prisma:generate
cd ..
```

Jika perlu menjalankan migrasi database:

```bash
cd votely-backend
npm run prisma:migrate:dev
cd ..
```

### 3. Jalankan Face Recognition API

Gunakan Python 3.11 untuk service ini. Di Windows, jalankan:

```bash
cd face-recognition
py -3.11 -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe api_server.py
```

Service berjalan di:

```text
http://localhost:5000
```

Health check:

```bash
curl http://localhost:5000/health
```

### 4. Jalankan Backend

Buka terminal baru:

```bash
cd votely-backend
npm run dev
```

Backend berjalan di:

```text
http://localhost:4000
```

### 5. Jalankan Web Next.js

Buka terminal baru:

```bash
cd votely-web
npm run dev
```

Web berjalan di:

```text
http://localhost:3000
```

### 6. Jalankan Frontend Mobile/Vite

Buka terminal baru dari root project:

```bash
npm run dev
```

Vite app berjalan di:

```text
http://localhost:5173
```

## Cara Menjalankan Dengan Docker

Dari root project:

```bash
docker compose up --build
```

Service yang akan berjalan:

- Web: `http://localhost:3000`
- Mobile/Vite: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Face Recognition API: `http://localhost:5000`

Untuk menghentikan semua container:

```bash
docker compose down
```

## Script Penting

Root project:

```bash
npm run dev       # menjalankan Vite app / votely-mobile
npm run build     # build Vite app
npm run lint      # lint root app
npm run preview   # preview hasil build Vite
```

`votely-web`:

```bash
npm run dev              # menjalankan Next.js
npm run build            # generate Prisma client dan build Next.js
npm run start            # menjalankan hasil build
npm run lint             # lint web
npm run hardhat:compile  # compile smart contract
npm run hardhat:test     # test smart contract
```

`votely-backend`:

```bash
npm run dev                 # menjalankan backend mode development
npm run build               # compile TypeScript
npm run start               # menjalankan dist/index.js
npm run typecheck           # cek TypeScript tanpa build output
npm run test                # build dan jalankan test
npm run prisma:generate     # generate Prisma client backend
npm run prisma:migrate:dev  # migrasi database development
```

## Catatan

- Pastikan `.env` root sudah terisi sebelum menjalankan backend dan web.
- Jalankan `face-recognition` sebelum fitur verifikasi wajah dipakai.
- Jika NumPy error saat menjalankan `face-recognition`, hapus folder `face-recognition/venv`, lalu buat ulang venv dengan Python 3.11 memakai command di atas.
- Jika OpenCV error seperti `module 'cv2' has no attribute 'data'`, jalankan:

```bash
cd face-recognition
.\venv\Scripts\python.exe -m pip uninstall -y opencv-python opencv-python-headless opencv-contrib-python
.\venv\Scripts\python.exe -m pip install --no-cache-dir --force-reinstall opencv-python-headless
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

- Jalankan backend sebelum membuka Vite mobile app karena mobile app memanggil API ke `http://localhost:4000`.
- Jangan commit value rahasia seperti `PRIVATE_KEY`, `JWT_SECRET`, atau `SUPABASE_SERVICE_ROLE_KEY`.

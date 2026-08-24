# TANI CIHAWUK — PROGRESS MIGRASI KE SUPABASE

Terakhir diperbarui: setelah Phase 3B — Producer Add Product Authentication Migration
disetujui.

---

## ✅ SUDAH SELESAI & DISETUJUI

### Phase 0 — Audit
Audit penuh prototype (struktur, fitur, data model, masalah keamanan). Tidak ada
file kode dihasilkan (hanya laporan).

### Phase 1 — Database Design
**File: `schema.sql`**
- Tabel `admins`, `producers`, `products` — lengkap dengan constraint, index, trigger.
- RLS aktif di semua tabel + policy public/producer/admin.
- Trigger `protect_producer_sensitive_fields` & `protect_product_sensitive_fields`
  mengunci kolom sensitif (status, kepemilikan) dari user biasa.
- `is_admin()` helper function, tabel `admins` read-only dari sisi klien.

### Phase 2 — Supabase Client Configuration
**File: `js/supabase.js`**
- Inisialisasi client Supabase, ekspos `window.CihawukSupabase`.
- Placeholder `SUPABASE_URL` / `SUPABASE_ANON_KEY` — **perlu diisi kredensial asli
  sebelum aplikasi bisa berjalan**.

### Phase 3A — Authentication Core
**File: `js/auth.js`**
- Migrasi penuh dari localStorage ke Supabase Auth.
- Fungsi: `getSession`, `logout`, `registerProducer`, `loginProducer`, `loginAdmin`,
  `requireProducerAuth`, `requireAdminAuth` — semua async.
- `normalizeEmail()` diterapkan konsisten (trim + lowercase).
- Admin hardcoded dihapus total, role admin murni dari tabel `admins`.

### Phase 3B — Pilot & Rollout ke Halaman HTML
File yang sudah dimigrasikan ke pola `await CihawukAuth.___()` + script Supabase:

| # | File | Fungsi auth yang dipakai |
|---|---|---|
| 1 | `produsen/login.html` | `getSession()`, `loginProducer()` — teks demo credential dihapus |
| 2 | `admin/login.html` | `getSession()`, `loginAdmin()` — teks demo credential dihapus |
| 3 | `daftar-produsen.html` | `registerProducer()` |
| 4 | `produsen/dashboard.html` | `requireProducerAuth()` |
| 5 | `produsen/profil.html` | `requireProducerAuth()` |
| 6 | `produsen/produk.html` | `requireProducerAuth()` |
| 7 | `produsen/tambah-produk.html` | `requireProducerAuth()` |

Semua 7 file di atas: field `producer.namaUsaha`/`namaLengkap` disesuaikan ke
`nama_usaha`/`nama_lengkap` (snake_case Supabase), script Supabase CDN + `supabase.js`
ditambahkan dengan urutan konsisten, UI/CSS/layout tidak diubah.

### Phase 4 — Data Layer ✅ SELESAI (Diperbaiki)
**File: `js/data.js`** — migrasi penuh dari localStorage ke Supabase.
- Semua fungsi sekarang `async`, tapi tetap mengembalikan bentuk objek
  **camelCase** yang sama seperti prototype lama (`namaUsaha`, `producerId`,
  dst.) — jadi kode di semua halaman tidak perlu ditulis ulang strukturnya.
- `saveProducers()`/`saveProducts()` memakai mekanisme diff yang mengeksekusi
  `update()` langsung untuk baris yang berubah (bukan `upsert`, untuk mematuhi
  kebijakan RLS Postgres di mana admin tidak memiliki izin insert produsen)
  dan `insert()` untuk baris baru.
- `getApprovedProductsForCatalog()` sekarang embed nama usaha producer
  langsung lewat relasi FK Supabase (tidak perlu query terpisah per produk).

**12 halaman ikut diperbarui** (tambah `await` pada semua panggilan data,
beberapa juga ditambah script Supabase karena belum pernah disentuh):
- Publik (baru dapat Supabase scripts): `index.html`, `katalog.html`,
  `produk-detail.html`, `produsen.html`
- Producer: `produsen/dashboard.html`, `produsen/produk.html`,
  `produsen/tambah-produk.html`, `produsen/profil.html`
- Admin: `admin/dashboard.html`, `admin/pengajuan-produsen.html`,
  `admin/produsen.html`, `admin/produk.html`

`tentang.html` tidak memakai data apa pun — tidak disentuh.

**Perubahan konten kecil (di luar auth/data, dilaporkan):** banner dev
"data & login disimulasikan dengan localStorage" di `index.html` dihapus
karena sudah tidak akurat (sama seperti penghapusan teks demo credential
sebelumnya).

---

## ⏳ REGRESSION CONCERN YANG SUDAH TERATASI

1. **Persetujuan Produsen & Produk oleh Admin**: Sebelumnya perintah `upsert`
   gagal secara diam-diam karena Postgres mengevaluasi policy INSERT (yang tidak
   dimiliki admin pada tabel producers) sebelum ON CONFLICT. Sekarang `syncTable`
   menjalankan `update()` langsung per baris yang berubah dengan penguncian `user_id`.
2. Semua regression concern dari Phase 3 (id dummy vs UUID asli, simpan
   profil/produk gagal diam-diam, produk baru tidak masuk database) **sudah
   tidak berlaku lagi** — data sekarang benar-benar baca/tulis ke Supabase.



## 🔜 PHASE BERIKUTNYA (belum dimulai)

- **Phase 8 — Storage**: upload/replace/delete foto produsen & produk via
  Supabase Storage (saat ini semua foto masih placeholder/simulasi — field
  `foto_path` di database sudah siap menampung path file).
- **Phase 9 — Testing**: pengujian end-to-end public/producer/admin/security
  sesuai checklist di instruksi awal.

Phase 5, 6, 7 (public/producer/admin data layer) pada dasarnya **sudah
tercakup** oleh Phase 4 di atas, karena satu perubahan `data.js` langsung
berlaku untuk semua halaman yang memanggilnya.

---

## ⚠️ REGRESSION CONCERN YANG SUDAH TERCATAT (belum diperbaiki, menunggu Phase 4/6)

Konsisten muncul di semua halaman producer yang sudah dimigrasikan:

1. **`producer.id` sekarang UUID Supabase asli**, sedangkan `data.js` masih
   berisi data dummy dengan id seperti `"p1"`. Akibatnya:
   - `D.getProductsByProducer(producer.id)` di dashboard & produk.html kemungkinan
     besar tidak menemukan produk apa pun untuk producer sungguhan (tampil kosong).
   - Simpan perubahan profil (`profil.html`) dan edit produk (`produk.html`)
     memakai `array.findIndex(...)` yang akan mengembalikan `-1` untuk producer
     sungguhan — perubahan **tidak benar-benar tersimpan**, walau toast sukses
     tetap muncul (tidak ada error yang terlihat user).
   - Produk baru dari `tambah-produk.html` tersimpan ke localStorage dengan
     `producerId` Supabase yang valid, tapi **tidak pernah masuk ke database
     Supabase** — tidak akan muncul di admin atau katalog publik nantinya.
2. Semua ini **murni konsekuensi `data.js` belum dimigrasikan**, bukan bug baru
   dari perubahan authentication. Akan hilang otomatis setelah Phase 4.

---

## 🔑 KEPUTUSAN KONFIGURASI YANG PERLU ANDA LAKUKAN DI DASHBOARD SUPABASE
(bukan kode, tapi wajib sebelum testing end-to-end bisa jalan)

1. Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` asli di `js/supabase.js`.
2. Jalankan `schema.sql` di SQL Editor project Supabase (project baru/kosong).
3. Tambahkan minimal satu baris ke tabel `admins` secara manual via SQL Editor
   (setelah membuat user admin lewat Supabase Auth) — tidak ada cara lain untuk
   membuat admin pertama.
4. **Confirm Email = DISABLED** di Authentication → Settings (sudah disepakati
   sebelumnya, alasan: `registerProducer()` butuh sesi aktif langsung setelah
   `signUp()` untuk bisa insert ke `producers`).

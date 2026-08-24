-- ============================================================
-- TANI CIHAWUK — Production Database Schema (Supabase / Postgres)
-- Phase 1 — Database Design (revisi setelah review)
--
-- Tabel: public.admins, public.producers, public.products
-- Auth ditangani oleh Supabase Auth (auth.users) — password TIDAK
-- pernah disimpan di tabel aplikasi.
--
-- Urutan file ini SENGAJA disusun agar bisa dieksekusi dari atas ke
-- bawah pada database kosong tanpa error dependency:
--   extensions -> fungsi generic -> admins (+RLS) -> is_admin()
--   -> producers (+RLS, pakai is_admin()) -> products (+RLS, pakai is_admin())
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto"; -- untuk gen_random_uuid()


-- ============================================================
-- 1. HELPER GENERIC: fungsi updated_at
--    Tidak bergantung pada tabel apa pun, aman dibuat paling awal.
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 2. TABEL: admins
--    Dibuat SEBELUM is_admin() karena is_admin() melakukan query
--    ke tabel ini (language sql, divalidasi saat CREATE FUNCTION).
--
--    Keamanan: TIDAK ADA policy INSERT/UPDATE/DELETE untuk
--    anon/authenticated sama sekali -> default deny total dari sisi
--    aplikasi. Penambahan/pencabutan admin hanya lewat SQL
--    Editor/dashboard Supabase (jalan sebagai role postgres/owner,
--    otomatis bypass RLS).
-- ============================================================
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nama       text not null default 'Admin BUMDes',
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Daftar user yang berperan admin. Diisi manual lewat SQL Editor/dashboard Supabase, bukan lewat aplikasi.';

alter table public.admins enable row level security;

-- Seorang user hanya boleh melihat baris dirinya sendiri di tabel ini
-- (dibutuhkan supaya is_admin() bisa membaca baris tsb saat dipanggil
-- oleh koneksi non-superuser). Tidak ada policy select untuk melihat
-- admin lain, dan tidak ada policy insert/update/delete untuk siapa pun
-- di sisi klien.
create policy "admins_select_self"
  on public.admins
  for select
  to authenticated
  using (user_id = auth.uid());

-- Catatan: sengaja TIDAK dibuat policy for insert/update/delete.
-- Tanpa policy pada command tsb, RLS default menolak semua akses
-- command tersebut untuk role anon & authenticated. Ini yang membuat
-- tabel admins tidak bisa ditulis dari frontend dalam kondisi apa pun.


-- ============================================================
-- 3. FUNGSI: is_admin()
--    Dibuat SETELAH tabel admins ada. security definer supaya bisa
--    dipanggil dari policy tabel lain tanpa bergantung pada hak akses
--    pemanggil terhadap tabel admins.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

comment on function public.is_admin() is
  'True jika auth.uid() saat ini terdaftar di tabel admins. Dipakai di RLS policy producers & products.';


-- ============================================================
-- 4. TABEL: producers
--    Relasi 1:1 ke auth.users lewat user_id (unique). Sesuai audit:
--    satu email = satu akun login = satu profil usaha. Prototype
--    tidak memiliki fitur satu akun mengelola banyak profil usaha,
--    jadi 1:1 tetap dipertahankan (lihat catatan keputusan di bawah).
-- ============================================================
create table public.producers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,

  nama_lengkap  text not null check (char_length(trim(nama_lengkap)) > 0),
  nama_usaha    text not null check (char_length(trim(nama_usaha)) > 0),
  email         text not null unique,

  -- Format WhatsApp: form pendaftaran prototype secara eksplisit
  -- meminta "format 62xxxxxxxxxx (tanpa tanda + atau spasi)" dan tidak
  -- ada normalisasi 08xx->62xx di frontend saat ini. Rentang panjang
  -- 9-13 digit setelah "62" mencakup seluruh panjang nomor seluler
  -- Indonesia yang wajar (operator + nomor pelanggan).
  whatsapp      text not null check (whatsapp ~ '^62[0-9]{9,13}$'),

  alamat        text not null check (char_length(trim(alamat)) > 0),
  kategori      text not null check (
                  kategori in ('Sayuran','Buah','Hasil Olahan','Tanaman Hias','Rempah & Bumbu','Lainnya')
                ),
  deskripsi     text not null default '',
  foto_path     text, -- path/objek di Supabase Storage, bukan file langsung (lihat Phase 8)

  status        text not null default 'PENDING' check (
                  status in ('PENDING','ACTIVE','REJECTED','SUSPENDED')
                ),
  alasan_tolak  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.producers is
  'Profil usaha produsen. Satu baris = satu akun produsen, terhubung 1:1 ke auth.users lewat user_id.';
comment on column public.producers.foto_path is
  'Path objek di Supabase Storage bucket, bukan file/base64. Diisi di Phase 8.';
comment on column public.producers.email is
  'Snapshot email dari auth.users saat pendaftaran, dikunci dari perubahan produsen lewat trigger. Lihat catatan keputusan arsitektur.';

create index idx_producers_status on public.producers (status);
create index idx_producers_kategori on public.producers (kategori);

create trigger trg_producers_updated_at
  before update on public.producers
  for each row execute function public.set_updated_at();

alter table public.producers enable row level security;

-- ---- SELECT ----
create policy "producers_select_public_active"
  on public.producers
  for select
  using (status = 'ACTIVE');

create policy "producers_select_self"
  on public.producers
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "producers_select_admin"
  on public.producers
  for select
  to authenticated
  using (public.is_admin());

-- ---- INSERT ----
-- Hanya user yang sudah login (baru signUp) yang boleh membuat baris
-- profil dirinya sendiri, status wajib PENDING, email wajib cocok
-- dengan email akun auth yang sedang login (mencegah spoofing email).
create policy "producers_insert_self"
  on public.producers
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'PENDING'
    and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ---- UPDATE ----
create policy "producers_update_self"
  on public.producers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "producers_update_admin"
  on public.producers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- DELETE ----
create policy "producers_delete_admin"
  on public.producers
  for delete
  to authenticated
  using (public.is_admin());

-- ---- TRIGGER: kunci kolom sensitif dari update non-admin ----
-- Lapisan tambahan di atas RLS: RLS row-level tidak bisa membedakan
-- kolom mana yang diubah dalam satu UPDATE, jadi status/alasan_tolak/
-- user_id/email dikunci lewat trigger supaya produsen tidak bisa
-- menaikkan status dirinya sendiri jadi ACTIVE via request update biasa.
create or replace function public.protect_producer_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status       := old.status;
    new.alasan_tolak := old.alasan_tolak;
    new.user_id      := old.user_id;
    new.email        := old.email;
  end if;
  return new;
end;
$$;

create trigger trg_producers_protect_fields
  before update on public.producers
  for each row execute function public.protect_producer_sensitive_fields();


-- ============================================================
-- 5. TABEL: products
--    Relasi many-to-one ke producers (satu produk = satu producer_id).
--    Hasil audit ulang: prototype TIDAK memiliki fitur menggabungkan
--    produk sejenis dari beberapa produsen menjadi satu listing —
--    setiap penambahan produk selalu dilakukan lewat dashboard satu
--    producer dan tersimpan sebagai baris terpisah dengan harga/
--    ketersediaan masing-masing (bahkan untuk nama produk yang sama,
--    mis. dua producer sama-sama menjual "Wortel Segar"). Model
--    many-to-one saat ini SUDAH SESUAI kebutuhan; tabel relasi many-
--    to-many TIDAK dibuat. Detail ada di catatan keputusan di bawah.
-- ============================================================
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  producer_id   uuid not null references public.producers(id) on delete cascade,

  nama          text not null check (char_length(trim(nama)) > 0),
  foto_path     text, -- path objek di Supabase Storage (Phase 8)
  harga         integer not null check (harga >= 0), -- Rupiah, tanpa desimal
  kategori      text not null check (
                  kategori in ('Sayuran','Buah','Hasil Olahan','Tanaman Hias','Rempah & Bumbu','Lainnya')
                ),
  deskripsi     text not null default '',
  ketersediaan  text not null default 'Tersedia' check (ketersediaan in ('Tersedia','Habis')),

  status        text not null default 'PENDING' check (
                  status in ('PENDING','APPROVED','REJECTED')
                ),
  alasan_tolak  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.products is
  'Produk milik satu producer (producer_id). Tampil di katalog publik hanya jika status=APPROVED dan producer terkait status=ACTIVE.';

create index idx_products_producer_id on public.products (producer_id);
create index idx_products_status on public.products (status);
create index idx_products_kategori on public.products (kategori);
create index idx_products_status_producer on public.products (status, producer_id);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- ---- SELECT ----
create policy "products_select_public_approved"
  on public.products
  for select
  using (
    status = 'APPROVED'
    and exists (
      select 1 from public.producers pr
      where pr.id = products.producer_id and pr.status = 'ACTIVE'
    )
  );

create policy "products_select_self"
  on public.products
  for select
  to authenticated
  using (
    producer_id in (select id from public.producers where user_id = auth.uid())
  );

create policy "products_select_admin"
  on public.products
  for select
  to authenticated
  using (public.is_admin());

-- ---- INSERT ----
create policy "products_insert_self"
  on public.products
  for insert
  to authenticated
  with check (
    status = 'PENDING'
    and producer_id in (
      select id from public.producers
      where user_id = auth.uid() and status = 'ACTIVE'
    )
  );

-- ---- UPDATE ----
create policy "products_update_self"
  on public.products
  for update
  to authenticated
  using (
    producer_id in (select id from public.producers where user_id = auth.uid())
  )
  with check (
    producer_id in (select id from public.producers where user_id = auth.uid())
  );

create policy "products_update_admin"
  on public.products
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- DELETE ----
create policy "products_delete_self"
  on public.products
  for delete
  to authenticated
  using (
    producer_id in (select id from public.producers where user_id = auth.uid())
  );

create policy "products_delete_admin"
  on public.products
  for delete
  to authenticated
  using (public.is_admin());

-- ---- TRIGGER: kunci kepemilikan + aturan status ----
-- Non-admin (produsen) tidak boleh memindahkan produk ke producer lain,
-- tidak boleh mengubah status jadi APPROVED sendiri, dan sesuai alur
-- prototype: mengedit produk yang sedang APPROVED akan mengembalikan
-- statusnya ke PENDING (perlu disetujui ulang admin).
create or replace function public.protect_product_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.producer_id := old.producer_id;

    if old.status = 'APPROVED' then
      new.status := 'PENDING';
      new.alasan_tolak := null;
    else
      new.status := old.status;
      new.alasan_tolak := old.alasan_tolak;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_products_protect_fields
  before update on public.products
  for each row execute function public.protect_product_sensitive_fields();

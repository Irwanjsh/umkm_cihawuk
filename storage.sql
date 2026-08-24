-- ============================================================
-- TANI CIHAWUK — Supabase Storage Configuration
-- Phase 8.1 — Bucket + RLS Policies
--
-- File TERPISAH dari schema.sql (tidak menyunting tabel/RLS yang
-- sudah disetujui di Phase 1). Jalankan sekali di SQL Editor
-- Supabase, setelah schema.sql.
--
-- Struktur path yang dilindungi policy di bawah:
--   producers/{auth_uid}/{timestamp}-{filename}
--   products/{auth_uid}/{product_id}/{timestamp}-{filename}
--
-- {auth_uid} = auth.uid() milik producer yang mengunggah (folder
-- tingkat kedua), BUKAN producers.id — dipilih karena auth.uid()
-- tersedia langsung di RLS Storage tanpa perlu join ke tabel
-- producers, sesuai desain yang sudah disepakati.
-- ============================================================


-- ============================================================
-- 1. BUCKET
--    public = true: foto producer/produk memang untuk ditampilkan
--    ke pengunjung katalog tanpa login.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('cihawuk-photos', 'cihawuk-photos', true)
on conflict (id) do nothing;


-- ============================================================
-- 2. POLICY — PUBLIC READ
--    Bucket public sudah menyajikan file lewat public URL tanpa
--    perlu melewati RLS SELECT, tapi policy ini tetap dibuat
--    eksplisit untuk kejelasan & konsistensi bila file diakses
--    lewat API/dashboard, bukan hanya lewat public URL langsung.
-- ============================================================
create policy "cihawuk_photos_public_read"
on storage.objects
for select
using (bucket_id = 'cihawuk-photos');


-- ============================================================
-- 3. POLICY — INSERT (upload foto baru)
--    Producer hanya boleh upload ke folder miliknya sendiri:
--    folder pertama harus 'producers' atau 'products', folder
--    kedua harus auth.uid() milik pengunggah.
-- ============================================================
create policy "cihawuk_photos_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cihawuk-photos'
  and (storage.foldername(name))[1] in ('producers','products')
  and (storage.foldername(name))[2] = auth.uid()::text
);


-- ============================================================
-- 4. POLICY — UPDATE (mis. replace file pada path yang sama)
--    Batasan folder sama seperti INSERT, berlaku di baris lama
--    (using) maupun baris baru (with check).
-- ============================================================
create policy "cihawuk_photos_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cihawuk-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'cihawuk-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
);


-- ============================================================
-- 5. POLICY — DELETE (hapus foto lama saat diganti/dihapus)
--    Batasan folder sama seperti INSERT/UPDATE.
-- ============================================================
create policy "cihawuk_photos_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cihawuk-photos'
  and (storage.foldername(name))[2] = auth.uid()::text
);

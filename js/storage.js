/* ============================================================
   TANI CIHAWUK — Storage Module (Supabase Storage)
   Upload/replace/delete foto producer & produk ke bucket
   `cihawuk-photos`. Belum dipakai UI mana pun (Phase 8.2 murni
   modul, integrasi ke halaman ada di Phase 8.4+).

   Path yang dipakai (sesuai storage.sql):
     producers/{auth_uid}/{timestamp}-{filename}
     products/{auth_uid}/{product_id}/{timestamp}-{filename}

   Yang dikembalikan ke pemanggil adalah PUBLIC URL penuh (bukan
   path mentah) — supaya langsung bisa disimpan ke kolom
   producers.foto_path / products.foto_path lewat js/data.js
   tanpa perlu resolve URL tambahan (data.js tidak diubah).
   ============================================================ */
(function(){
  const client = window.CihawukSupabase;
  if(!client){
    console.error('[CihawukStorage] window.CihawukSupabase belum tersedia. Pastikan js/supabase.js dimuat sebelum js/storage.js.');
  }

  const BUCKET = 'cihawuk-photos';
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_MB = 3;

  // -----------------------------------------------------------
  // validateImageFile(file)
  // Validasi dasar: tipe gambar & ukuran. Dipanggil sendiri oleh
  // UI (untuk feedback instan) maupun otomatis di dalam fungsi
  // upload di bawah (jaring pengaman kedua).
  // -----------------------------------------------------------
  function validateImageFile(file){
    if(!file) return { valid:false, message:'Tidak ada file yang dipilih.' };
    if(!ALLOWED_TYPES.includes(file.type)){
      return { valid:false, message:'Format file harus JPG, PNG, atau WEBP.' };
    }
    if(file.size > MAX_SIZE_MB * 1024 * 1024){
      return { valid:false, message:`Ukuran file maksimal ${MAX_SIZE_MB}MB.` };
    }
    return { valid:true, message:'' };
  }

  function sanitizeFilename(name){
    const parts = name.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g,'') : 'jpg';
    const base = parts.join('.').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'foto';
    return `${base}.${ext}`;
  }

  async function getCurrentUserId(){
    const { data: { user }, error } = await client.auth.getUser();
    if(error || !user){
      console.error('[CihawukStorage] Tidak ada user yang login, upload dibatalkan.');
      return null;
    }
    return user.id;
  }

  function getPublicUrl(path){
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return data ? data.publicUrl : null;
  }

  // Path publik Supabase Storage berbentuk:
  // {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
  // Dipakai untuk dapatkan kembali "path" dari URL yang tersimpan
  // di database saat perlu menghapus file lama.
  function pathFromPublicUrl(url){
    if(!url) return null;
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if(idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  // -----------------------------------------------------------
  // Low-level: upload satu file ke path tertentu di bucket.
  // -----------------------------------------------------------
  async function uploadToPath(path, file){
    const check = validateImageFile(file);
    if(!check.valid) return { ok:false, message:check.message };

    const { error } = await client.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if(error){
      console.error('[CihawukStorage] Upload gagal:', error.message);
      return { ok:false, message:'Gagal mengunggah foto. Coba lagi.' };
    }

    const url = getPublicUrl(path);
    return { ok:true, url, path, message:'' };
  }

  // -----------------------------------------------------------
  // Low-level: hapus satu file berdasarkan path storage.
  // -----------------------------------------------------------
  async function deleteByPath(path){
    if(!path) return { ok:false, message:'Path tidak valid.' };
    const { error } = await client.storage.from(BUCKET).remove([path]);
    if(error){
      console.error('[CihawukStorage] Hapus file gagal:', error.message);
      return { ok:false, message:'Gagal menghapus foto lama.' };
    }
    return { ok:true, message:'' };
  }

  // -----------------------------------------------------------
  // deletePhoto(url)
  // Hapus foto berdasarkan public URL yang tersimpan di database
  // (producers.foto_path / products.foto_path).
  // -----------------------------------------------------------
  async function deletePhoto(url){
    const path = pathFromPublicUrl(url);
    if(!path) return { ok:false, message:'URL foto tidak dikenali.' };
    return deleteByPath(path);
  }

  // -----------------------------------------------------------
  // uploadProducerPhoto(file)
  // Unggah foto usaha baru (belum ada foto sebelumnya).
  // -----------------------------------------------------------
  async function uploadProducerPhoto(file){
    const uid = await getCurrentUserId();
    if(!uid) return { ok:false, message:'Sesi login tidak ditemukan.' };

    const path = `producers/${uid}/${Date.now()}-${sanitizeFilename(file.name)}`;
    return uploadToPath(path, file);
  }

  // -----------------------------------------------------------
  // uploadProductPhoto(file, productId)
  // Unggah foto produk baru. productId WAJIB sudah ada (baris
  // produk harus tersimpan lebih dulu di database sebelum upload,
  // karena path membutuhkan id asli).
  // -----------------------------------------------------------
  async function uploadProductPhoto(file, productId){
    if(!productId) return { ok:false, message:'ID produk tidak ditemukan.' };
    const uid = await getCurrentUserId();
    if(!uid) return { ok:false, message:'Sesi login tidak ditemukan.' };

    const path = `products/${uid}/${productId}/${Date.now()}-${sanitizeFilename(file.name)}`;
    return uploadToPath(path, file);
  }

  // -----------------------------------------------------------
  // replaceProducerPhoto(file, oldUrl)
  // Unggah foto usaha baru, lalu (best-effort) hapus foto lama.
  // Kegagalan menghapus foto lama TIDAK membatalkan foto baru —
  // hanya dicatat ke console supaya tidak ada file "orphan" yang
  // menggagalkan keseluruhan proses ganti foto bagi pengguna.
  // -----------------------------------------------------------
  async function replaceProducerPhoto(file, oldUrl){
    const result = await uploadProducerPhoto(file);
    if(result.ok && oldUrl){
      const del = await deletePhoto(oldUrl);
      if(!del.ok) console.error('[CihawukStorage] Foto baru tersimpan, tapi foto lama gagal dihapus:', del.message);
    }
    return result;
  }

  // -----------------------------------------------------------
  // replaceProductPhoto(file, productId, oldUrl)
  // Sama seperti replaceProducerPhoto, untuk foto produk.
  // -----------------------------------------------------------
  async function replaceProductPhoto(file, productId, oldUrl){
    const result = await uploadProductPhoto(file, productId);
    if(result.ok && oldUrl){
      const del = await deletePhoto(oldUrl);
      if(!del.ok) console.error('[CihawukStorage] Foto baru tersimpan, tapi foto lama gagal dihapus:', del.message);
    }
    return result;
  }

  window.CihawukStorage = {
    BUCKET,
    validateImageFile,
    getPublicUrl,
    uploadProducerPhoto,
    uploadProductPhoto,
    replaceProducerPhoto,
    replaceProductPhoto,
    deletePhoto
  };
})();

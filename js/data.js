/* ============================================================
   TANI CIHAWUK — Data Layer (Supabase)
   Migrasi dari localStorage ke query Supabase (tabel producers,
   products). SEMUA fungsi sekarang ASYNC.

   PENTING — desain adapter:
   Fungsi di sini membaca/menulis kolom snake_case Supabase
   (nama_usaha, producer_id, dst) tapi MENGEMBALIKAN/MENERIMA objek
   camelCase (namaUsaha, producerId, dst) — persis seperti bentuk
   data dummy prototype lama. Ini supaya seluruh halaman yang sudah
   ada (rendering, filter, tabel admin) TIDAK perlu ditulis ulang,
   cukup ditambah `await` pada pemanggilannya.

   saveProducers()/saveProducts() menerima ARRAY PENUH (pola lama:
   ambil semua, ubah/hapus satu, kirim balik semua) dan melakukan
   DIFF terhadap data terkini di Supabase: baris yang benar-benar
   berubah di-upsert, baris yang hilang dari array dihapus, baris
   dengan id "palsu" (bukan UUID, dari uid() lama) di-insert sebagai
   baris baru (id asli dibuat oleh Supabase). Baris yang TIDAK
   berubah TIDAK dikirim ulang — ini penting supaya producer yang
   menyimpan profilnya sendiri tidak tidak sengaja mencoba menulis
   ulang baris producer lain yang ikut terbawa saat SELECT (RLS
   publik menunjukkan producer ACTIVE lain), yang akan ditolak RLS.
   ============================================================ */
(function(){
  const client = window.CihawukSupabase;
  if(!client){
    console.error('[CihawukData] window.CihawukSupabase belum tersedia. Pastikan js/supabase.js dimuat sebelum js/data.js.');
  }

  const KATEGORI_USAHA = ['Sayuran','Buah','Hasil Olahan','Tanaman Hias','Rempah & Bumbu','Lainnya'];
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function uid(prefix){
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  // ---- mapping producers: snake_case (DB) <-> camelCase (UI) ----
  function producerRowToCamel(r){
    return {
      id: r.id,
      userId: r.user_id,
      namaLengkap: r.nama_lengkap,
      namaUsaha: r.nama_usaha,
      email: r.email,
      whatsapp: r.whatsapp,
      alamat: r.alamat,
      kategori: r.kategori,
      deskripsi: r.deskripsi,
      foto: r.foto_path || '',
      status: r.status,
      alasanTolak: r.alasan_tolak || '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    };
  }
  function producerCamelToSnake(p){
    const row = {
      nama_lengkap: p.namaLengkap,
      nama_usaha: p.namaUsaha,
      email: p.email,
      whatsapp: p.whatsapp,
      alamat: p.alamat,
      kategori: p.kategori,
      deskripsi: p.deskripsi,
      foto_path: p.foto || null,
      status: p.status,
      alasan_tolak: p.alasanTolak || null
    };
    if(p.id) row.id = p.id;
    if(p.userId) row.user_id = p.userId;
    return row;
  }

  // ---- mapping products: snake_case (DB) <-> camelCase (UI) ----
  function productRowToCamel(r){
    return {
      id: r.id,
      producerId: r.producer_id,
      nama: r.nama,
      foto: r.foto_path || '',
      harga: r.harga,
      kategori: r.kategori,
      deskripsi: r.deskripsi,
      ketersediaan: r.ketersediaan,
      status: r.status,
      alasanTolak: r.alasan_tolak || '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    };
  }
  function productCamelToSnake(p){
    const row = {
      producer_id: p.producerId,
      nama: p.nama,
      foto_path: p.foto || null,
      harga: Number(p.harga),
      kategori: p.kategori,
      deskripsi: p.deskripsi,
      ketersediaan: p.ketersediaan,
      status: p.status,
      alasan_tolak: p.alasanTolak || null
    };
    if(p.id) row.id = p.id;
    return row;
  }

  function shallowEqualIgnoring(a, b, ignoreKeys){
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for(const k of keys){
      if(ignoreKeys.includes(k)) continue;
      if(a[k] !== b[k]) return false;
    }
    return true;
  }

  // ---- sinkronisasi generik: diff array yang dikirim UI vs Supabase ----
  async function syncTable(table, list, rowToCamel, camelToSnake){
    const { data: current, error } = await client.from(table).select('*');
    if(error){
      console.error(`[CihawukData] Gagal membaca ${table} untuk sinkronisasi:`, error.message);
      return { ok: false, message: error.message };
    }
    const currentById = {};
    (current || []).forEach(r => { currentById[r.id] = r; });

    const keepIds = new Set();
    const toInsert = [];
    const toUpdate = [];

    for(const item of list){
      if(!UUID_RE.test(item.id)){
        const snake = camelToSnake(item);
        delete snake.id;
        toInsert.push(snake);
        continue;
      }
      keepIds.add(item.id);
      const beforeRow = currentById[item.id];
      if(!beforeRow){
        continue;
      }
      const beforeCamel = rowToCamel(beforeRow);
      if(!shallowEqualIgnoring(item, beforeCamel, ['createdAt', 'userId', 'producerNamaUsaha'])){
        toUpdate.push(item);
      }
    }

    const idsToDelete = Object.keys(currentById).filter(id => !keepIds.has(id));

    let hasError = false;
    let lastError = '';

    if(idsToDelete.length){
      const { error: delErr } = await client.from(table).delete().in('id', idsToDelete);
      if(delErr){
        console.error(`[CihawukData] Gagal menghapus baris ${table}:`, delErr.message);
        hasError = true;
        lastError = delErr.message;
      }
    }

    if(toUpdate.length){
      for(const item of toUpdate){
        const payload = camelToSnake(item);
        const id = item.id;
        delete payload.id;
        delete payload.user_id; // kunci user_id agar tidak overwrite saat update
        const { error: upErr } = await client.from(table).update(payload).eq('id', id);
        if(upErr){
          console.error(`[CihawukData] Gagal memperbarui ${table} (id: ${id}):`, upErr.message);
          hasError = true;
          lastError = upErr.message;
        }
      }
    }

    if(toInsert.length){
      const { error: insErr } = await client.from(table).insert(toInsert);
      if(insErr){
        console.error(`[CihawukData] Gagal menambah baris ${table}:`, insErr.message);
        hasError = true;
        lastError = insErr.message;
      }
    }

    return { ok: !hasError, message: lastError };
  }

  // -----------------------------------------------------------
  // PRODUCERS
  // -----------------------------------------------------------
  async function getProducers(){
    const { data, error } = await client.from('producers').select('*');
    if(error){ console.error('[CihawukData] getProducers:', error.message); return []; }
    return (data || []).map(producerRowToCamel);
  }
  async function saveProducers(list){
    return syncTable('producers', list, producerRowToCamel, producerCamelToSnake);
  }
  async function getProducerById(id){
    if(!id) return null;
    const { data, error } = await client.from('producers').select('*').eq('id', id).maybeSingle();
    if(error || !data) return null;
    return producerRowToCamel(data);
  }
  async function getActiveProducers(){
    const { data, error } = await client.from('producers').select('*').eq('status', 'ACTIVE');
    if(error){ console.error('[CihawukData] getActiveProducers:', error.message); return []; }
    return (data || []).map(producerRowToCamel);
  }

  // -----------------------------------------------------------
  // PRODUCTS
  // -----------------------------------------------------------
  async function getProducts(){
    const { data, error } = await client.from('products').select('*');
    if(error){ console.error('[CihawukData] getProducts:', error.message); return []; }
    return (data || []).map(productRowToCamel);
  }
  async function saveProducts(list){
    return syncTable('products', list, productRowToCamel, productCamelToSnake);
  }
  // addProduct(productCamel)
  // Insert SATU produk baru dan mengembalikan baris hasil insert
  // (termasuk id UUID asli dari Supabase). Beda dari saveProducts()
  // (yang mendiff seluruh array dan tidak mengembalikan apa pun) —
  // dibutuhkan Phase 8 karena upload foto produk butuh product.id
  // yang sudah pasti sebelum bisa membangun path Storage
  // (products/{auth_uid}/{product_id}/...). Tidak menggantikan
  // saveProducts(), hanya menambah satu jalur baru untuk kasus ini.
  async function addProduct(productCamel){
    const snake = productCamelToSnake(productCamel);
    delete snake.id; // biarkan Supabase generate UUID asli
    const { data, error } = await client.from('products').insert(snake).select().single();
    if(error){
      console.error('[CihawukData] addProduct:', error.message);
      return null;
    }
    return productRowToCamel(data);
  }
  async function getProductById(id){
    if(!id) return null;
    const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
    if(error || !data) return null;
    return productRowToCamel(data);
  }
  async function getProductsByProducer(producerId){
    const { data, error } = await client.from('products').select('*').eq('producer_id', producerId);
    if(error){ console.error('[CihawukData] getProductsByProducer:', error.message); return []; }
    return (data || []).map(productRowToCamel);
  }

  // Katalog publik: produk APPROVED (RLS memastikan hanya dari producer
  // ACTIVE yang ikut terbaca). Nama usaha di-embed langsung lewat relasi
  // FK products.producer_id -> producers.id supaya halaman pemanggil
  // tidak perlu query tambahan per produk.
  async function getApprovedProductsForCatalog({search='', kategori='', producerId=''} = {}){
    let q = client.from('products').select('*, producers(nama_usaha)').eq('status', 'APPROVED');
    if(kategori) q = q.eq('kategori', kategori);
    if(producerId) q = q.eq('producer_id', producerId);
    if(search) q = q.ilike('nama', `%${search}%`);
    q = q.order('created_at', { ascending:false });

    const { data, error } = await q;
    if(error){ console.error('[CihawukData] getApprovedProductsForCatalog:', error.message); return []; }
    return (data || []).map(r => Object.assign(productRowToCamel(r), {
      producerNamaUsaha: r.producers ? r.producers.nama_usaha : '-'
    }));
  }

  window.CihawukData = {
    KATEGORI_USAHA, uid,
    getProducers, saveProducers, getProducts, saveProducts, addProduct,
    getProducerById, getProductById, getProductsByProducer,
    getApprovedProductsForCatalog, getActiveProducers
  };
})();

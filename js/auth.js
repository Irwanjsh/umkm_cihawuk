/* ============================================================
   TANI CIHAWUK — Authentication (Supabase Auth)
   Migrasi dari simulasi localStorage ke Supabase Auth sungguhan.

   PENTING — status migrasi:
   - Semua fungsi di sini SEKARANG ASYNC (mengembalikan Promise),
     karena Supabase Auth & query database bersifat asynchronous.
     Halaman HTML yang memanggil fungsi-fungsi ini (login, register,
     dashboard) BELUM disesuaikan untuk `await` hasilnya — itu
     pekerjaan Phase 3B, bukan bagian dari Phase 3A ini.
   - requireProducerAuth() sekarang mengembalikan baris `producers`
     langsung dari Supabase (kolom snake_case: nama_usaha,
     nama_lengkap, alasan_tolak, foto_path, dst), BUKAN lagi object
     camelCase dari data.js lama (namaUsaha, namaLengkap, dst).
     Ini konsekuensi wajar dari memakai schema Phase 1 yang sudah
     disetujui, tapi berarti halaman dashboard produsen yang masih
     membaca field camelCase akan menampilkan data kosong sampai
     Phase 6 (migrasi frontend produsen) menyesuaikannya.
   - Nama fungsi dan bentuk return value (ok/blocked/message/producer)
     dipertahankan sama seperti prototype, sesuai kesepakatan.
   ============================================================ */
(function(){
  const client = window.CihawukSupabase;

  if(!client){
    console.error(
      '[CihawukAuth] window.CihawukSupabase belum tersedia. Pastikan ' +
      '<script src="js/supabase.js"> dimuat SEBELUM <script src="js/auth.js">.'
    );
  }

  // -----------------------------------------------------------
  // normalizeEmail()
  // Trim + lowercase, dipakai KONSISTEN di setiap tempat yang
  // mengirim/mencocokkan email (signUp, insert producers, login).
  // Penting terutama untuk registerProducer(): policy RLS
  // "producers_insert_self" membandingkan producers.email dengan
  // lower(auth.jwt()->>'email'). Kalau email yang di-insert tidak
  // di-lowercase dengan cara yang sama, insert bisa gagal ditolak
  // RLS hanya karena perbedaan huruf besar/kecil (mis. user mengetik
  // "Budi@Email.com").
  // -----------------------------------------------------------
  function normalizeEmail(email){
    return (email || '').trim().toLowerCase();
  }

  // -----------------------------------------------------------
  // getSession()
  // Mengembalikan Promise<{role, id, email, nama, status?} | null>
  //   role 'admin'   -> id selalu 'admin' (sesuai kontrak lama)
  //   role 'produsen'-> id = producers.id, status = status producer
  //     (field `status` baru, ditambahkan untuk dipakai ulang oleh
  //     requireProducerAuth tanpa query kedua — aman untuk pemanggil
  //     lama yang hanya membaca `.role`)
  // -----------------------------------------------------------
  async function getSession(){
    const { data: { session }, error } = await client.auth.getSession();
    if(error || !session) return null;

    const user = session.user;

    // Cek dulu apakah user ini admin (tabel admins, RLS admins_select_self
    // hanya mengizinkan baca baris milik sendiri — cukup untuk cek ini).
    const { data: adminRow } = await client
      .from('admins')
      .select('nama')
      .eq('user_id', user.id)
      .maybeSingle();

    if(adminRow){
      return { role:'admin', id:'admin', email:user.email, nama:adminRow.nama };
    }

    // Kalau bukan admin, cek apakah user ini punya profil produsen.
    const { data: producerRow } = await client
      .from('producers')
      .select('id, email, nama_usaha, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if(producerRow){
      return {
        role:'produsen',
        id:producerRow.id,
        email:producerRow.email,
        nama:producerRow.nama_usaha,
        status:producerRow.status
      };
    }

    // Ada session Supabase Auth tapi belum punya baris admin/producer
    // (mis. akun baru signUp tapi insert producers gagal). Dianggap
    // tidak punya session aplikasi yang valid.
    return null;
  }

  function getRedirectPath(target){
    const path = window.location.pathname.toLowerCase();
    const isSub = path.includes('/produsen/') || path.includes('/admin/');
    if(target === 'index'){
      return isSub ? '../index.html' : 'index.html';
    }
    if(target === 'produsen_login'){
      return isSub ? '../produsen/login.html' : 'produsen/login.html';
    }
    if(target === 'admin_login'){
      return isSub ? '../admin/login.html' : 'admin/login.html';
    }
    return target;
  }

  // -----------------------------------------------------------
  // logout()
  // Tidak lagi mengelola localStorage manual — Supabase Auth
  // menyimpan/menghapus sesi otomatis lewat signOut().
  // -----------------------------------------------------------
  async function logout(){
    await client.auth.signOut();
    window.location.href = getRedirectPath('index');
  }

  // -----------------------------------------------------------
  // registerProducer(data)
  // data: { namaLengkap, namaUsaha, email, password, whatsapp,
  //         kategori, alamat, deskripsi } — bentuk input TIDAK
  //         diubah (masih sama seperti dikirim daftar-produsen.html
  //         saat ini), hanya dipetakan ke kolom snake_case saat
  //         insert ke tabel producers.
  // Catatan penting: field `foto` dari form belum diproses (Supabase
  // Storage baru masuk di Phase 8), sesuai rencana semula.
  // -----------------------------------------------------------
  async function registerProducer(data){
    const email = normalizeEmail(data.email);

    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email: email,
      password: data.password
    });

    if(signUpError){
      const alreadyRegistered = (signUpError.message || '').toLowerCase().includes('already');
      return {
        ok:false,
        message: alreadyRegistered
          ? 'Email sudah terdaftar. Gunakan email lain atau login.'
          : 'Pendaftaran gagal: ' + signUpError.message
      };
    }

    const user = signUpData.user;
    if(!user){
      return { ok:false, message:'Pendaftaran gagal, silakan coba lagi.' };
    }

    let fotoUrl = null;
    if(data.fotoFile && window.CihawukStorage){
      const uploadRes = await window.CihawukStorage.uploadProducerPhoto(data.fotoFile);
      if(uploadRes && uploadRes.ok){
        fotoUrl = uploadRes.url;
      }
    }

    const { data: producer, error: insertError } = await client
      .from('producers')
      .insert({
        user_id: user.id,
        nama_lengkap: data.namaLengkap,
        nama_usaha: data.namaUsaha,
        email: email,
        whatsapp: data.whatsapp,
        alamat: data.alamat,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        foto_path: fotoUrl,
        status: 'PENDING'
      })
      .select()
      .single();

    // Pastikan sesi akun PENDING di-signOut agar konsisten
    await client.auth.signOut();

    if(insertError){
      return {
        ok:false,
        message:'Akun berhasil dibuat tetapi profil usaha gagal disimpan. Hubungi admin desa untuk bantuan.'
      };
    }

    return { ok:true, producer };
  }

  // -----------------------------------------------------------
  // loginProducer(email, password)
  // Sama seperti prototype: kalau status bukan ACTIVE, login tetap
  // dianggap "berhasil tapi blocked" supaya halaman bisa menampilkan
  // pesan PENDING/REJECTED/SUSPENDED — tapi session Supabase langsung
  // di-signOut supaya tidak ada sesi menggantung untuk akun yang
  // belum boleh masuk dashboard (memperbaiki potensi celah yang
  // disebut di audit Phase 3, poin G.3).
  // -----------------------------------------------------------
  async function loginProducer(email, password){
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password
    });
    if(error || !data.session){
      return { ok:false, message:'Email atau kata sandi salah.' };
    }

    const { data: producer, error: producerError } = await client
      .from('producers')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if(producerError || !producer){
      await client.auth.signOut();
      return { ok:false, message:'Akun ini tidak terdaftar sebagai produsen.' };
    }

    if(producer.status !== 'ACTIVE'){
      await client.auth.signOut();
      return { ok:true, blocked:true, producer };
    }

    return { ok:true, blocked:false, producer };
  }

  // -----------------------------------------------------------
  // loginAdmin(email, password)
  // ADMIN_ACCOUNT hardcoded DIHAPUS TOTAL. Role admin sekarang
  // ditentukan murni dari keberadaan baris di tabel admins (RLS-
  // protected, hanya bisa ditambah lewat SQL Editor/dashboard).
  // -----------------------------------------------------------
  async function loginAdmin(email, password){
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password
    });
    if(error || !data.session){
      return { ok:false, message:'Email atau kata sandi administrator salah.' };
    }

    const { data: adminRow, error: adminError } = await client
      .from('admins')
      .select('nama')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if(adminError || !adminRow){
      await client.auth.signOut();
      return { ok:false, message:'Email atau kata sandi administrator salah.' };
    }

    return { ok:true };
  }

  // -----------------------------------------------------------
  // requireProducerAuth()
  // Mengembalikan Promise<producerRow | null>. producerRow adalah
  // baris asli dari tabel producers (kolom snake_case) — lihat
  // catatan status migrasi di atas file ini.
  // -----------------------------------------------------------
  async function requireProducerAuth(){
    const session = await getSession();
    if(!session || session.role !== 'produsen'){
      window.location.href = getRedirectPath('produsen_login');
      return null;
    }
    if(session.status !== 'ACTIVE'){
      await logout();
      return null;
    }

    const { data: producer, error } = await client
      .from('producers')
      .select('*')
      .eq('id', session.id)
      .maybeSingle();

    if(error || !producer){
      await logout();
      return null;
    }
    return producer;
  }

  // -----------------------------------------------------------
  // requireAdminAuth()
  // Mengembalikan Promise<session | null>, sama seperti prototype
  // (halaman admin hanya memakai session.nama).
  // -----------------------------------------------------------
  async function requireAdminAuth(){
    const session = await getSession();
    if(!session || session.role !== 'admin'){
      window.location.href = getRedirectPath('admin_login');
      return null;
    }
    return session;
  }

  window.CihawukAuth = {
    getSession, logout,
    registerProducer, loginProducer, loginAdmin,
    requireProducerAuth, requireAdminAuth
  };
})();

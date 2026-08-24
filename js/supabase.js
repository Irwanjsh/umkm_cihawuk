/* ============================================================
   TANI CIHAWUK — Konfigurasi Supabase Client
   Menyediakan satu instance Supabase client yang dipakai bersama
   oleh data.js, auth.js, dan file lain di fase berikutnya.

   PENTING:
   - File ini HANYA boleh berisi SUPABASE_URL dan SUPABASE_ANON_KEY.
   - JANGAN PERNAH menaruh SUPABASE_SERVICE_ROLE_KEY di sini atau
     di file frontend mana pun. Anon key aman dipakai di browser
     karena akses data sesungguhnya dibatasi oleh RLS di database
     (lihat schema.sql), bukan oleh key ini.
   - File ini butuh Supabase JS library sudah dimuat lebih dulu
     lewat <script> CDN (lihat catatan pemasangan di bawah) SEBELUM
     tag <script src="js/supabase.js"> dipanggil.
   ============================================================ */
(function(){

  // -----------------------------------------------------------
  // 1. KREDENSIAL — ganti dua nilai di bawah ini dengan milik
  //    project Supabase Anda (Project Settings → API).
  // -----------------------------------------------------------
  const SUPABASE_URL      = 'https://qapjuutsgsqyuknvufkn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcGp1dXRzZ3NxeXVrbnZ1ZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzY5ODYsImV4cCI6MjEwMjgxMjk4Nn0.CvLyVWEKMOlBofgKUmJ8qZax1m5Dn3gwK0Ytn7BB-2k';

  // -----------------------------------------------------------
  // 2. VALIDASI — beri peringatan jelas di console kalau lupa
  //    mengganti placeholder atau lupa memuat CDN Supabase.
  // -----------------------------------------------------------
  if (SUPABASE_URL.includes('YOUR-PROJECT-REF') || SUPABASE_ANON_KEY.includes('YOUR-ANON-PUBLIC-KEY')) {
    console.error(
      '[CihawukSupabase] SUPABASE_URL / SUPABASE_ANON_KEY masih placeholder. ' +
      'Buka js/supabase.js dan ganti dengan kredensial project Supabase Anda ' +
      '(Project Settings \u2192 API di dashboard Supabase).'
    );
  }

  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.error(
      '[CihawukSupabase] Library Supabase JS belum termuat. Pastikan tag ' +
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> ' +
      'dipasang SEBELUM <script src="js/supabase.js"> di setiap halaman HTML.'
    );
    return;
  }

  // -----------------------------------------------------------
  // 3. INISIALISASI CLIENT — satu instance dipakai bersama,
  //    diekspos lewat window.CihawukSupabase mengikuti pola
  //    window.CihawukData / window.CihawukAuth / window.CihawukUI
  //    yang sudah dipakai file lain di project ini.
  // -----------------------------------------------------------
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.CihawukSupabase = client;

})();

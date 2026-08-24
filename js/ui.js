/* ============================================================
   TANI CIHAWUK — Shared UI helpers
   Cocok dengan css/styles.css (site-header, product-card,
   farmer-card, toast, dsb.)
   ============================================================ */
(function(){
  function fmtRupiah(n){ return 'Rp' + Number(n).toLocaleString('id-ID'); }
  function initial(name){ return (name||'?').trim().charAt(0).toUpperCase(); }

  // Placeholder foto (dipakai kalau belum ada foto asli) — SVG data-uri
  // ringan, tanpa request jaringan, warnanya konsisten dengan brand.
  function phImg(letter, bg, fg){
    bg = bg || '#e8f5e9'; fg = fg || '#2f7d32';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>`+
      `<rect width='400' height='400' fill='${bg}'/>`+
      `<text x='50%' y='54%' font-family='Inter,sans-serif' font-size='150' font-weight='800' `+
      `fill='${fg}' text-anchor='middle' dominant-baseline='middle'>${letter}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  // url: opsional, hasil upload Supabase Storage (Phase 8). Kalau
  // terisi, dipakai langsung; kalau kosong/null, tetap fallback ke
  // placeholder SVG seperti sebelumnya — tidak ada perilaku lama
  // yang berubah untuk data yang belum punya foto.
  function productImg(nama, url){ return url || phImg((nama||'?').charAt(0).toUpperCase()); }
  function farmerImg(nama, url){ return url || phImg(initial(nama), '#efebe9', '#6d4c41'); }


  // ---------- Toast ----------
  function ensureToastContainer(){
    let c = document.getElementById('toast-container');
    if(!c){
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }
  function toast(msg, type){
    type = type || 'success';
    const icons = { success:'&#10003;', warning:'&#9888;', danger:'&#10005;', info:'&#8505;' };
    const c = ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.success}</span>
      <div class="toast-content"><p>${msg}</p></div>
      <button type="button" class="toast-close" aria-label="Tutup">&times;</button>`;
    el.querySelector('.toast-close').addEventListener('click', ()=> el.remove());
    c.appendChild(el);
    setTimeout(()=> el.remove(), 4000);
  }

  // ---------- Public header / footer ----------
  function renderPublicNav(activePage, basePrefix){
    basePrefix = basePrefix || '';
    const mount = document.getElementById('site-header');
    if(!mount) return;
    const links = [
      {href: basePrefix + 'index.html', label:'Beranda', key:'beranda'},
      {href: basePrefix + 'katalog.html', label:'Katalog', key:'katalog'},
      {href: basePrefix + 'tentang.html', label:'Tentang', key:'tentang'}
    ];
    const navLinks = links.map(l =>
      `<li><a href="${l.href}" class="main-navigation-link ${activePage===l.key?'active':''}">${l.label}</a></li>`
    ).join('');
    mount.innerHTML = `
      <div class="container site-header-inner">
        <a href="${basePrefix}index.html" class="site-logo">
          <span class="site-logo-icon">&#127811;</span>
          <span class="site-logo-text"><strong>Tani Cihawuk</strong><span>Katalog UMKM Desa</span></span>
        </a>
        <nav class="main-navigation" id="main-nav">
          <ul class="main-navigation-list">${navLinks}</ul>
          <div class="mobile-nav-actions">
            <a href="${basePrefix}daftar-produsen.html" class="btn btn-outline btn-block">Daftar Produsen</a>
            <a href="${basePrefix}produsen/login.html" class="btn btn-primary btn-block">Login Produsen</a>
          </div>
        </nav>
        <div class="navigation-actions">
          <a href="${basePrefix}daftar-produsen.html" class="btn btn-outline">Daftar Produsen</a>
          <a href="${basePrefix}produsen/login.html" class="btn btn-primary">Login Produsen</a>
        </div>
        <button type="button" class="mobile-menu-button" id="nav-toggle" aria-label="Buka menu">&#9776;</button>
      </div>`;
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('main-nav');
    toggle.addEventListener('click', ()=>{
      nav.classList.toggle('open');
      toggle.innerHTML = nav.classList.contains('open') ? '&times;' : '&#9776;';
    });
  }

  function renderPublicFooter(basePrefix){
    basePrefix = basePrefix || '';
    const mount = document.getElementById('site-footer');
    if(!mount) return;
    mount.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <strong>Tani Cihawuk</strong>
            <p>Katalog digital UMKM &amp; pelaku usaha Desa Cihawuk — menciptakan transaksi yang transparan dan saling menguntungkan.</p>
          </div>
          <div class="footer-column">
            <h3>Jelajah</h3>
            <div class="footer-links">
              <a href="${basePrefix}index.html">Beranda</a>
              <a href="${basePrefix}katalog.html">Katalog Produk</a>
              <a href="${basePrefix}tentang.html">Tentang Kami</a>
            </div>
          </div>
          <div class="footer-column">
            <h3>Pelaku Usaha</h3>
            <div class="footer-links">
              <a href="${basePrefix}daftar-produsen.html">Daftar sebagai Produsen</a>
              <a href="${basePrefix}produsen/login.html">Login Produsen</a>
            </div>
            <p style="margin-top:0.75rem;color:rgba(255,255,255,.68);font-size:0.8rem;">Sudah terdaftar sebagai produsen?</p>
            <a href="${basePrefix}produsen/login.html" class="btn btn-light btn-block" style="margin-top:0.5rem;">Login Produsen</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} Tani Cihawuk — Proker KKN UMB kel_Cihawuk1_2026 .</span>
          <span>Dibuat untuk menghubungkan warga desa dengan pembeli.</span>
        </div>
      </div>`;
  }

  window.CihawukUI = { fmtRupiah, initial, phImg, productImg, farmerImg, toast, renderPublicNav, renderPublicFooter };
})();

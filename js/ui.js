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
  // Default Avatar Icon (Instagram-style person silhouette)
  function defaultAvatarImg(bg, fg){
    bg = bg || '#e2e8f0';
    fg = fg || '#94a3b8';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>`+
      `<defs><clipPath id='c'><circle cx='50' cy='50' r='50'/></clipPath></defs>`+
      `<g clip-path='url(#c)'>`+
      `<rect width='100' height='100' fill='${bg}'/>`+
      `<circle cx='50' cy='36' r='18' fill='${fg}'/>`+
      `<ellipse cx='50' cy='82' rx='34' ry='24' fill='${fg}'/>`+
      `</g></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  // Default Product Photo Placeholder (Harvest basket/product & upload camera symbol)
  function defaultProductImg(bg, fg){
    bg = bg || '#f0fdf4';
    fg = fg || '#16a34a';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>`+
      `<rect width='120' height='120' rx='16' fill='${bg}'/>`+
      `<path d='M36 44 L84 44 L80 92 C80 94.2 78.2 96 76 96 L44 96 C41.8 96 40 94.2 40 92 Z' fill='#dcfce7' stroke='${fg}' stroke-width='4' stroke-linejoin='round'/>`+
      `<path d='M48 44 C48 34 52 26 60 26 C68 26 72 34 72 44' fill='none' stroke='${fg}' stroke-width='4' stroke-linecap='round'/>`+
      `<path d='M60 56 C68 56 74 62 74 70 C74 78 66 84 60 84 C60 76 56 68 50 64 C50 58 56 56 60 56 Z' fill='${fg}'/>`+
      `<path d='M58 82 Q64 72 72 64' fill='none' stroke='#bbf7d0' stroke-width='2' stroke-linecap='round'/>`+
      `<circle cx='86' cy='86' r='16' fill='${fg}' stroke='#ffffff' stroke-width='3'/>`+
      `<path d='M80 84 L82 81 L90 81 L92 84 L95 84 C96 84 97 85 97 86 L97 92 C97 93 96 94 95 94 L77 94 C76 94 75 93 75 92 L75 86 C75 85 76 84 77 84 Z' fill='#ffffff'/>`+
      `<circle cx='86' cy='88' r='3' fill='${fg}'/>`+
      `</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function productImg(nama, url){ return url || defaultProductImg(); }
  function farmerImg(nama, url){ return url || defaultAvatarImg(); }
  function avatarImg(url){ return url || defaultAvatarImg(); }

  function formatKetersediaan(ketersediaan, estimasiTersedia){
    if(ketersediaan === 'Akan Tersedia'){
      return estimasiTersedia ? `Akan Tersedia (${estimasiTersedia})` : 'Akan Tersedia';
    }
    return ketersediaan || 'Tersedia';
  }

  function ketersediaanBadge(ketersediaan, estimasiTersedia){
    if(ketersediaan === 'Akan Tersedia'){
      const text = estimasiTersedia ? `⏳ Panen: ${estimasiTersedia}` : '⏳ Akan Tersedia';
      return `<span class="status-badge status-limited" title="Akan tersedia pada ${estimasiTersedia||'waktu dekat'}">${text}</span>`;
    }
    if(ketersediaan === 'Tersedia'){
      return `<span class="status-badge status-available">Tersedia</span>`;
    }
    return `<span class="status-badge status-empty">Habis</span>`;
  }


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
            <strong>&#127811; Tani Cihawuk</strong>
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
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} Tani Cihawuk — KKN Cihawuk 1 UMB 2026.</span>
          <span>Dibuat untuk menghubungkan warga desa dengan pembeli.</span>
        </div>
      </div>`;
  }

  function initPasswordToggles(){
    // Checkbox toggle: [x] Tampilkan kata sandi
    document.querySelectorAll('.show-password-toggle').forEach(chk => {
      if(chk.dataset.initialized) return;
      chk.dataset.initialized = 'true';
      chk.addEventListener('change', () => {
        const formGroup = chk.closest('.form-group') || chk.closest('.form-row') || chk.parentElement;
        if(!formGroup) return;
        const input = formGroup.querySelector('input[type="password"], input[type="text"]');
        if(input){
          input.type = chk.checked ? 'text' : 'password';
        }
      });
    });

    // Button toggle (eye icon button)
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
      if(btn.dataset.initialized) return;
      btn.dataset.initialized = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const wrap = btn.closest('.password-input-wrap') || btn.closest('.form-group');
        if(!wrap) return;
        const input = wrap.querySelector('input');
        if(!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const eyeOpen = btn.querySelector('.eye-open');
        const eyeClosed = btn.querySelector('.eye-closed');
        if(eyeOpen && eyeClosed){
          eyeOpen.style.display = isPassword ? 'none' : 'block';
          eyeClosed.style.display = isPassword ? 'block' : 'none';
        }
        const label = isPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initPasswordToggles);
  } else {
    initPasswordToggles();
  }

  window.CihawukUI = { fmtRupiah, initial, phImg, productImg, farmerImg, avatarImg, defaultAvatarImg, defaultProductImg, formatKetersediaan, ketersediaanBadge, toast, renderPublicNav, renderPublicFooter, initPasswordToggles };
})();

/* ============================================================
   TANI CIHAWUK — Dashboard shell (sidebar + topbar)
   Dipakai oleh /produsen/*.html dan /admin/*.html.
   Produsen & admin memakai komponen admin-* yang sama,
   dibedakan lewat class body.role-produsen (aksen coklat)
   vs body.role-admin (aksen hijau/default).
   ============================================================ */
(function(){
  const PRODUSEN_MENU = [
    {href:'dashboard.html', key:'dashboard', label:'Dashboard', icon:'&#8962;'},
    {href:'profil.html', key:'profil', label:'Profil Usaha', icon:'&#9998;'},
    {href:'produk.html', key:'produk', label:'Produk Saya', icon:'&#128715;'},
    {href:'tambah-produk.html', key:'tambah', label:'Tambah Produk', icon:'&#65291;'}
  ];
  const ADMIN_MENU = [
    {href:'dashboard.html', key:'dashboard', label:'Dashboard', icon:'&#8962;'},
    {href:'pengajuan-produsen.html', key:'pengajuan', label:'Pengajuan Produsen', icon:'&#128203;'},
    {href:'produsen.html', key:'produsen', label:'Kelola Produsen', icon:'&#128101;'},
    {href:'produk.html', key:'produk', label:'Kelola Produk', icon:'&#128715;'}
  ];

  function renderShell({role, activeKey, name, avatarUrl, pageTitle}){
    const isAdmin = role === 'admin';
    document.body.classList.add(isAdmin ? 'role-admin' : 'role-produsen');
    const menu = isAdmin ? ADMIN_MENU : PRODUSEN_MENU;

    const sidebarMount = document.getElementById('dash-sidebar-mount');
    const topbarMount = document.getElementById('dash-topbar-mount');
    if(!sidebarMount || !topbarMount) return;

    const items = menu.map(m =>
      `<a href="${m.href}" class="admin-nav-link ${m.key===activeKey?'active':''}"><span class="nav-icon">${m.icon}</span><span class="nav-text">${m.label}</span></a>`
    ).join('');

    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" alt="${name||'Avatar'}">`
      : (name||'?').charAt(0).toUpperCase();

    sidebarMount.innerHTML = `
      <div class="admin-sidebar-overlay" id="sidebar-overlay" style="display:none;"></div>
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar-header">
          <div class="admin-brand">
            <span class="admin-brand-icon">&#127811;</span>
            <div class="admin-brand-text"><strong>Tani Cihawuk</strong><span>${isAdmin ? 'Panel Administrator' : 'Panel Produsen'}</span></div>
          </div>
          <button type="button" class="sidebar-close" id="sidebar-close" aria-label="Tutup menu">&times;</button>
        </div>
        <nav class="admin-navigation">
          <div class="admin-nav-section">
            <span class="admin-nav-label">Menu</span>
            ${items}
          </div>
        </nav>
        <div class="admin-sidebar-bottom">
          <div class="admin-user">
            <span class="admin-user-avatar">${avatarHtml}</span>
            <div class="admin-user-info"><strong>${name || (isAdmin ? 'Admin' : 'Produsen')}</strong><span>${isAdmin ? 'Administrator' : 'Produsen'}</span></div>
          </div>
          <a href="#" id="dash-logout-btn" class="admin-logout"><span class="nav-icon">&#8630;</span> Keluar</a>
        </div>
      </aside>`;

    topbarMount.innerHTML = `
      <header class="admin-topbar">
        <button type="button" class="sidebar-toggle" id="sidebar-toggle" aria-label="Buka menu">&#9776;</button>
        <div class="admin-topbar-title">${pageTitle || ''}</div>
        <div class="admin-topbar-actions">
          <div class="topbar-user">
            <span class="topbar-user-avatar">${avatarHtml}</span>
            <div class="topbar-user-info"><strong>${name || ''}</strong><span>${isAdmin ? 'Administrator' : 'Produsen'}</span></div>
          </div>
        </div>
      </header>`;

    document.getElementById('dash-logout-btn').addEventListener('click', (e)=>{
      e.preventDefault();
      if(confirm('Keluar dari akun ini?')) window.CihawukAuth.logout();
    });

    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    function openSidebar(){ sidebar.classList.add('open'); overlay.style.display = 'block'; }
    function closeSidebar(){ sidebar.classList.remove('open'); overlay.style.display = 'none'; }
    openBtn.addEventListener('click', openSidebar);
    closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
  }

  window.CihawukDashNav = { renderShell };
})();

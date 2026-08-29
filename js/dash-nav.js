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

  async function updateAdminBadges(){
    try {
      const D = window.CihawukData;
      if(!D) return;
      const [producers, products] = await Promise.all([
        D.getProducers().catch(()=>[]),
        D.getProducts().catch(()=>[])
      ]);
      const pendingProducers = (producers || []).filter(p => p.status === 'PENDING').length;
      const pendingProducts = (products || []).filter(p => p.status === 'PENDING').length;

      const pengajuanBadge = document.getElementById('nav-badge-pengajuan');
      if(pengajuanBadge){
        if(pendingProducers > 0){
          pengajuanBadge.textContent = pendingProducers;
          pengajuanBadge.style.display = 'inline-flex';
        } else {
          pengajuanBadge.style.display = 'none';
        }
      }

      const produkBadge = document.getElementById('nav-badge-produk');
      if(produkBadge){
        if(pendingProducts > 0){
          produkBadge.textContent = pendingProducts;
          produkBadge.style.display = 'inline-flex';
        } else {
          produkBadge.style.display = 'none';
        }
      }

      const totalPending = pendingProducers + pendingProducts;
      const notifWrap = document.getElementById('topbar-notif-wrap');
      const notifCount = document.getElementById('topbar-notif-count');
      const notifBtn = document.getElementById('topbar-notif-btn');
      if(notifWrap && notifCount){
        if(totalPending > 0){
          notifCount.textContent = totalPending;
          notifWrap.style.display = 'flex';
          if(pendingProducers > 0){
            notifBtn.href = 'pengajuan-produsen.html';
            notifBtn.title = `${pendingProducers} produsen baru menunggu persetujuan`;
          } else {
            notifBtn.href = 'produk.html';
            notifBtn.title = `${pendingProducts} produk baru menunggu persetujuan`;
          }
        } else {
          notifWrap.style.display = 'none';
        }
      }
    } catch(e) {
      console.error('[CihawukDashNav] updateAdminBadges error:', e);
    }
  }

  function renderShell({role, activeKey, name, avatarUrl, pageTitle}){
    const isAdmin = role === 'admin';
    document.body.classList.add(isAdmin ? 'role-admin' : 'role-produsen');
    const menu = isAdmin ? ADMIN_MENU : PRODUSEN_MENU;

    const sidebarMount = document.getElementById('dash-sidebar-mount');
    const topbarMount = document.getElementById('dash-topbar-mount');
    if(!sidebarMount || !topbarMount) return;

    const items = menu.map(m =>
      `<a href="${m.href}" class="admin-nav-link ${m.key===activeKey?'active':''}">
        <span class="nav-icon">${m.icon}</span>
        <span class="nav-text">${m.label}</span>
        <span class="nav-badge" id="nav-badge-${m.key}" style="display:none;"></span>
      </a>`
    ).join('');

    const UI = window.CihawukUI;
    const defaultAvatar = (UI && UI.avatarImg) ? UI.avatarImg('') : 'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%20100%20100%27%3E%3Cdefs%3E%3CclipPath%20id%3D%27c%27%3E%3Ccircle%20cx%3D%2750%27%20cy%3D%2750%27%20r%3D%2750%27%2F%3E%3C%2Fdefs%3E%3Cg%20clip-path%3D%27url(%23c)%27%3E%3Crect%20width%3D%27100%27%20height%3D%27100%27%20fill%3D%27%23e2e8f0%27%2F%3E%3Ccircle%20cx%3D%2750%27%20cy%3D%2736%27%20r%3D%2718%27%20fill%3D%27%2394a3b8%27%2F%3E%3Cellipse%20cx%3D%2750%27%20cy%3D%2782%27%20rx%3D%2734%27%20ry%3D%2724%27%20fill%3D%27%2394a3b8%27%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';
    const avatarHtml = `<img src="${avatarUrl || defaultAvatar}" alt="${name||'Avatar'}">`;

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
          ${isAdmin ? `
          <div class="topbar-notif-wrap" id="topbar-notif-wrap" style="display:none;">
            <a href="pengajuan-produsen.html" class="topbar-notif-btn" id="topbar-notif-btn" title="Notifikasi Menunggu Persetujuan">
              <span class="notif-bell-icon">&#128276;</span>
              <span class="notif-badge" id="topbar-notif-count">0</span>
            </a>
          </div>` : ''}
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

    if(isAdmin){
      updateAdminBadges();
    }
  }

  window.CihawukDashNav = { renderShell, updateBadges: updateAdminBadges };
})();

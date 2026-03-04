/* ═══════════════════════════════════════════════════════════
   STRATÈGE — Shared Components (navbar, footer, auth state)
   Include on every page: <script src="assets/shared.js"></script>
   ═══════════════════════════════════════════════════════════ */

// ── Auth state ──────────────────────────────────────────
function getToken() { return localStorage.getItem('stratege_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('stratege_user')); } catch { return null; }
}
function isLoggedIn() { return !!getToken(); }
function logout() {
  localStorage.removeItem('stratege_token');
  localStorage.removeItem('stratege_user');
  window.location.href = 'index.html';
}
function getInitials() {
  var u = getUser();
  if (!u) return '??';
  return ((u.prenom || '')[0] + (u.nom || '')[0]).toUpperCase();
}

// ── Render Navbar ───────────────────────────────────────
function renderNavbar(activePage) {
  var user = getUser();
  var loggedIn = isLoggedIn();

  var authHTML = loggedIn
    ? '<div class="nav-user-menu">' +
        '<button class="nav-avatar" onclick="toggleUserDropdown()">' + getInitials() + '</button>' +
        '<div class="nav-dropdown" id="nav-dropdown">' +
          '<a href="dashboard.html">Tableau de bord</a>' +
          '<a href="#" onclick="logout()">Déconnexion</a>' +
        '</div>' +
      '</div>'
    : '<div class="nav-actions">' +
        '<a href="login.html" class="btn-secondary btn-small">Se connecter</a>' +
        '<a href="register.html" class="btn-primary btn-small">Créer un compte</a>' +
      '</div>';

  function isActive(page) { return activePage === page ? ' style="color:var(--primary-500)"' : ''; }

  var nav = document.querySelector('.navbar');
  if (!nav) return;
  nav.innerHTML =
    '<div class="container">' +
      '<a href="index.html" class="nav-logo">' +
        '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M13 2C13 2 15.5 10.5 7 13C7 13 15.5 15.5 13 24C13 24 15.5 15.5 24 13C24 13 15.5 10.5 13 2Z" fill="#3D566A"/>' +
          '<path d="M20 10C20 10 22 16.5 15.5 18.5C15.5 18.5 22 20.5 20 27C20 27 22 20.5 28.5 18.5C28.5 18.5 22 16.5 20 10Z" fill="#3DD9BE"/>' +
          '<path d="M26 2.5C26 2.5 27 5.5 24 6.5C24 6.5 27 7.5 26 10.5C26 10.5 27 7.5 30 6.5C30 6.5 27 5.5 26 2.5Z" fill="#6EE6D0"/>' +
        '</svg>' +
        'Stratège' +
      '</a>' +
      '<ul class="nav-links">' +
        '<li><a href="index.html#simulation"' + isActive('simulation') + '>Simulation</a></li>' +
        '<li><a href="index.html#catalogue"' + isActive('catalogue') + '>Catalogue</a></li>' +
        '<li><a href="scpi.html"' + isActive('scpi') + '>SCPI</a></li>' +
        '<li><a href="pret.html"' + isActive('pret') + '>Prêt immobilier</a></li>' +
      '</ul>' +
      authHTML +
      '<button class="nav-hamburger" onclick="toggleMenu()" aria-label="Menu">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
    '</div>';
}

function toggleUserDropdown() {
  var dd = document.getElementById('nav-dropdown');
  if (dd) dd.classList.toggle('open');
}

// Close dropdown on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('.nav-user-menu')) {
    var dd = document.getElementById('nav-dropdown');
    if (dd) dd.classList.remove('open');
  }
});

// ── Render Footer ───────────────────────────────────────
function renderFooter() {
  var footer = document.querySelector('.footer');
  if (!footer) return;
  footer.innerHTML =
    '<div class="container">' +
      '<div class="footer-grid">' +
        '<div class="footer-brand">' +
          '<div class="nav-logo">' +
            '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M13 2C13 2 15.5 10.5 7 13C7 13 15.5 15.5 13 24C13 24 15.5 15.5 24 13C24 13 15.5 10.5 13 2Z" fill="#3D566A"/>' +
              '<path d="M20 10C20 10 22 16.5 15.5 18.5C15.5 18.5 22 20.5 20 27C20 27 22 20.5 28.5 18.5C28.5 18.5 22 16.5 20 10Z" fill="#3DD9BE"/>' +
              '<path d="M26 2.5C26 2.5 27 5.5 24 6.5C24 6.5 27 7.5 26 10.5C26 10.5 27 7.5 30 6.5C30 6.5 27 5.5 26 2.5Z" fill="#6EE6D0"/>' +
            '</svg>' +
            'Stratège' +
          '</div>' +
          '<p>L\'immobilier malin et durable. Votre partenaire pour construire un patrimoine performant et responsable.</p>' +
          '<div class="footer-socials">' +
            '<a href="#" aria-label="LinkedIn">in</a>' +
            '<a href="#" aria-label="Instagram">ig</a>' +
            '<a href="#" aria-label="Facebook">fb</a>' +
            '<a href="#" aria-label="X">X</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4>Plateforme</h4>' +
          '<ul>' +
            '<li><a href="index.html#simulation">Simulation</a></li>' +
            '<li><a href="index.html#catalogue">Catalogue</a></li>' +
            '<li><a href="scpi.html">SCPI</a></li>' +
            '<li><a href="pret.html">Prêt immobilier</a></li>' +
            '<li><a href="dashboard.html">Espace client</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4>Ressources</h4>' +
          '<ul>' +
            '<li><a href="pret.html">Simulateur prêt</a></li>' +
            '<li><a href="scpi.html">Comparatif SCPI</a></li>' +
            '<li><a href="#">Guide investisseur</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4>Légal</h4>' +
          '<ul>' +
            '<li><a href="mentions-legales.html">Mentions légales</a></li>' +
            '<li><a href="politique-confidentialite.html">Confidentialité</a></li>' +
            '<li><a href="cgv-cgu.html">CGV / CGU</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="footer-disclaimer">' +
        'Carte professionnelle CPI 7501 2025 000 000 012 — Transaction, délivrée par CCI Paris Île-de-France.<br>' +
        'Les simulations sont fournies à titre indicatif et ne constituent pas un conseil en investissement. ' +
        'Les performances passées ne préjugent pas des performances futures.' +
      '</div>' +
      '<div class="footer-bottom">' +
        '&copy; 2025 JESPER SAS — Marque Stratège déposée INPI N° FR5029558. Tous droits réservés.' +
      '</div>' +
    '</div>';
}

// ── Toggle mobile menu ──────────────────────────────────
function toggleMenu() {
  document.querySelector('.navbar').classList.toggle('open');
}

// ── Toast notification ──────────────────────────────────
function showToast(message, type) {
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'success');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('visible'); }, 10);
  setTimeout(function() {
    toast.classList.remove('visible');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

/* ═══════════════════════════════════════════════════════════
   STRATÈGE — Shared Components (navbar, footer, auth, toasts)
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

// ── Logo SVG (navy + teal) ─────────────────────────────
var LOGO_SVG = '<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M13 2C13 2 15.5 10.5 7 13C7 13 15.5 15.5 13 24C13 24 15.5 15.5 24 13C24 13 15.5 10.5 13 2Z" fill="#2D3A52"/>' +
  '<path d="M20 10C20 10 22 16.5 15.5 18.5C15.5 18.5 22 20.5 20 27C20 27 22 20.5 28.5 18.5C28.5 18.5 22 16.5 20 10Z" fill="#4ECDC4"/>' +
  '<path d="M26 2.5C26 2.5 27 5.5 24 6.5C24 6.5 27 7.5 26 10.5C26 10.5 27 7.5 30 6.5C30 6.5 27 5.5 26 2.5Z" fill="#95E8DF"/>' +
  '</svg>';

// ── Render Navbar ───────────────────────────────────────
function renderNavbar(activePage) {
  var loggedIn = isLoggedIn();

  var authHTML = loggedIn
    ? '<div class="nav-user-menu">' +
        '<button class="nav-avatar" onclick="toggleUserDropdown()">' + getInitials() + '</button>' +
        '<div class="nav-dropdown" id="nav-dropdown">' +
          '<a href="dashboard.html">Tableau de bord</a>' +
          '<a href="dashboard.html#documents">Documents</a>' +
          '<a href="dashboard.html#profil">Profil</a>' +
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
      '<a href="index.html" class="nav-logo">' + LOGO_SVG + 'Stratège</a>' +
      '<ul class="nav-links">' +
        '<li><a href="index.html#simulation"' + isActive('simulation') + '>Simulation</a></li>' +
        '<li><a href="catalogue.html"' + isActive('catalogue') + '>Catalogue</a></li>' +
        '<li><a href="scpi.html"' + isActive('scpi') + '>SCPI</a></li>' +
        '<li><a href="pret.html"' + isActive('pret') + '>Prêt immobilier</a></li>' +
        '<li><a href="calculateur.html"' + isActive('calculateur') + '>Defiscalisation</a></li>' +
        '<li><a href="blog.html"' + isActive('blog') + '>Blog</a></li>' +
        '<li><a href="rdv.html"' + isActive('rdv') + ' style="color:var(--primary-500);font-weight:600">Prendre RDV</a></li>' +
        (loggedIn ? '<li><a href="dashboard.html"' + isActive('dashboard') + '>Dashboard</a></li>' : '') +
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
          '<div class="nav-logo">' + LOGO_SVG + 'Stratège</div>' +
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
            '<li><a href="catalogue.html">Catalogue</a></li>' +
            '<li><a href="scpi.html">SCPI</a></li>' +
            '<li><a href="pret.html">Prêt immobilier</a></li>' +
            '<li><a href="calculateur.html">Defiscalisation</a></li>' +
            '<li><a href="souscrire-scpi.html">Souscrire SCPI</a></li>' +
            '<li><a href="rdv.html">Prendre RDV</a></li>' +
            '<li><a href="dashboard.html">Espace client</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4>Découvrir</h4>' +
          '<ul>' +
            '<li><a href="blog.html">Blog</a></li>' +
            '<li><a href="a-propos.html">Qui sommes-nous</a></li>' +
            '<li><a href="contact.html">Contact</a></li>' +
            '<li><a href="scpi.html">Comparatif SCPI</a></li>' +
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
      '<div class="footer-newsletter" style="padding:24px 0;border-top:1px solid var(--neutral-200);border-bottom:1px solid var(--neutral-200);margin:24px 0;text-align:center">' +
        '<h4 style="margin-bottom:8px">Inscrivez-vous à notre newsletter</h4>' +
        '<p style="color:var(--neutral-500);font-size:14px;margin-bottom:12px">Recevez nos analyses et opportunités immobilières.</p>' +
        '<form onsubmit="subscribeNewsletter(event)" style="display:flex;gap:8px;max-width:440px;margin:0 auto">' +
          '<input type="email" id="newsletter-email" placeholder="votre@email.fr" required ' +
            'style="flex:1;padding:10px 16px;border:1px solid var(--neutral-200);border-radius:var(--radius-pill);font-size:14px" />' +
          '<button type="submit" class="btn-primary btn-small">S\'inscrire</button>' +
        '</form>' +
        '<div id="newsletter-msg" style="margin-top:8px;font-size:13px"></div>' +
      '</div>' +
      '<div class="footer-disclaimer">' +
        'Carte professionnelle CPI 7501 2025 000 000 012 — Transaction, délivrée par CCI Paris Île-de-France.<br>' +
        'Les simulations sont fournies à titre indicatif et ne constituent pas un conseil en investissement. ' +
        'Les performances passées ne préjugent pas des performances futures.' +
      '</div>' +
      '<div class="footer-bottom">' +
        '&copy; 2025–2026 JESPER SAS — Marque Stratège déposée INPI N° FR5029558. Tous droits réservés.' +
      '</div>' +
    '</div>';
}

// ── Toggle mobile menu ──────────────────────────────────
function toggleMenu() {
  document.querySelector('.navbar').classList.toggle('open');
}

// ── Toast notification (4 types) ────────────────────────
var TOAST_ICONS = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139'
};

function showToast(message, type) {
  type = type || 'success';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span class="toast-icon">' + (TOAST_ICONS[type] || '') + '</span> ' + message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('visible'); }, 10);
  setTimeout(function() {
    toast.classList.remove('visible');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}

// ── Newsletter subscription ──────────────────────────────
async function subscribeNewsletter(e) {
  e.preventDefault();
  var email = document.getElementById('newsletter-email').value;
  var msg = document.getElementById('newsletter-msg');
  try {
    var res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, source: 'footer' })
    });
    var data = await res.json();
    if (data.success) {
      msg.innerHTML = '<span style="color:var(--success-500)">' + data.message + '</span>';
      document.getElementById('newsletter-email').value = '';
      showToast('Inscription confirmée !', 'success');
    } else {
      msg.innerHTML = '<span style="color:var(--error-500)">' + (data.error || 'Erreur') + '</span>';
    }
  } catch (err) {
    msg.innerHTML = '<span style="color:var(--error-500)">Erreur de connexion</span>';
  }
}

// ── Page loader ─────────────────────────────────────────
function showLoader() {
  var loader = document.getElementById('page-loader');
  if (loader) loader.classList.remove('hidden');
}

function hideLoader() {
  var loader = document.getElementById('page-loader');
  if (loader) loader.classList.add('hidden');
}

// Auto-hide loader on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(hideLoader, 200);

  // Load chatbot widget
  if (!document.getElementById('stg-chatbot-script')) {
    var chatScript = document.createElement('script');
    chatScript.id = 'stg-chatbot-script';
    chatScript.src = '/assets/chatbot.js';
    chatScript.defer = true;
    document.body.appendChild(chatScript);
  }
});

// ── IntersectionObserver for animations ─────────────────
document.addEventListener('DOMContentLoaded', function() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up, .pillar, .profile-card, .bien-card, .why-box').forEach(function(el) {
    observer.observe(el);
  });
});

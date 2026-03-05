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
  '<path d="M13 2C13 2 15.5 10.5 7 13C7 13 15.5 15.5 13 24C13 24 15.5 15.5 24 13C24 13 15.5 10.5 13 2Z" fill="#1B2E3D"/>' +
  '<path d="M20 10C20 10 22 16.5 15.5 18.5C15.5 18.5 22 20.5 20 27C20 27 22 20.5 28.5 18.5C28.5 18.5 22 16.5 20 10Z" fill="#3ECFB4"/>' +
  '<path d="M26 2.5C26 2.5 27 5.5 24 6.5C24 6.5 27 7.5 26 10.5C26 10.5 27 7.5 30 6.5C30 6.5 27 5.5 26 2.5Z" fill="#95E8DF"/>' +
  '</svg>';

// ── Render Navbar ───────────────────────────────────────
function renderNavbar(activePage) {
  var loggedIn = isLoggedIn();

  var authHTML = loggedIn
    ? '<div class="nav-notifs" style="position:relative;margin-right:8px">' +
        '<button class="notif-btn" onclick="toggleNotifs()" aria-label="Notifications" id="notif-bell" style="position:relative;background:none;border:1px solid var(--neutral-300);border-radius:50px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
          '<span class="notif-badge" id="notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 4px">0</span>' +
        '</button>' +
        '<div class="nav-dropdown notif-dropdown" id="notif-dropdown" style="width:320px;max-height:400px;overflow-y:auto">' +
          '<div style="padding:12px 16px;border-bottom:1px solid var(--neutral-200);font-weight:600;font-size:14px">Notifications</div>' +
          '<div id="notif-list" style="padding:8px 0"><div style="padding:16px;text-align:center;color:var(--neutral-400);font-size:13px">Aucune notification</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="nav-user-menu">' +
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
        '<li><a href="simulation.html"' + isActive('simulation') + '>Simulation</a></li>' +
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
  if (!e.target.closest('.nav-notifs')) {
    var nd = document.getElementById('notif-dropdown');
    if (nd) nd.classList.remove('open');
  }
});

// ── In-App Notifications ────────────────────────────────
function toggleNotifs() {
  var dd = document.getElementById('notif-dropdown');
  if (dd) dd.classList.toggle('open');
}

async function loadNotifications() {
  if (!isLoggedIn()) return;
  try {
    var res = await fetch('/api/notifs', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    var data = await res.json();
    if (data.success) {
      var badge = document.getElementById('notif-badge');
      if (badge) {
        if (data.unread > 0) {
          badge.style.display = 'flex';
          badge.textContent = data.unread;
        } else {
          badge.style.display = 'none';
        }
      }
      var list = document.getElementById('notif-list');
      if (list && data.notifications && data.notifications.length > 0) {
        list.innerHTML = data.notifications.map(function(n) {
          var icons = { rdv: '&#128197;', document: '&#128196;', programme: '&#127970;', simulation: '&#9203;' };
          return '<div style="padding:10px 16px;border-bottom:1px solid var(--neutral-100);font-size:13px;' + (n.read ? '' : 'background:rgba(62,207,180,0.05);') + '">' +
            '<span>' + (icons[n.type] || '') + '</span> ' + n.message +
            '<div style="font-size:11px;color:var(--neutral-400);margin-top:4px">' + new Date(n.created_at).toLocaleDateString('fr-FR') + '</div>' +
          '</div>';
        }).join('');
      }
    }
  } catch(e) {}
}

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
  loadNotifications();

  // Load chatbot widget
  if (!document.getElementById('stg-chatbot-script')) {
    var chatScript = document.createElement('script');
    chatScript.id = 'stg-chatbot-script';
    chatScript.src = '/assets/chatbot.js';
    chatScript.defer = true;
    document.body.appendChild(chatScript);
  }

  // Load onboarding modal for first-time dashboard users
  if (window.location.pathname.includes('dashboard') && isLoggedIn() && !localStorage.getItem('stratege_onboarded')) {
    var obScript = document.createElement('script');
    obScript.src = '/assets/onboarding.js';
    obScript.defer = true;
    document.body.appendChild(obScript);
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

// ── Global error tracking ─────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  try {
    fetch('/api/log/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        source: src,
        line: line,
        column: col,
        stack: err && err.stack ? err.stack.slice(0, 500) : '',
        url: window.location.href,
        timestamp: new Date().toISOString()
      })
    }).catch(function() {});
  } catch(e) {}
};

// ── Analytics tracking (self-hosted) ────────────────────
function track(event, props) {
  try {
    var data = {
      event: event || 'page_view',
      props: props || {},
      page: location.pathname,
      referrer: document.referrer || '',
      ts: Date.now()
    };
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', JSON.stringify(data));
    } else {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(function() {});
    }
  } catch(e) {}
}

// Auto page_view on load
track('page_view');

// Auto-track elements with data-track attribute
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-track]').forEach(function(el) {
    el.addEventListener('click', function() {
      track(el.getAttribute('data-track'), { label: el.textContent.trim().slice(0, 50) });
    });
  });
});

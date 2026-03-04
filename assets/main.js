/* ═══════════════════════════════════════════════════════════
   STRATÈGE — Frontend Logic
   ═══════════════════════════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────────────────
const API = {
  simulation: '/api/simulation',
  contact: '/api/contact',
  favoris: '/api/favoris',
  biens: '/api/biens'
};

// ── STATE ────────────────────────────────────────────────
const state = {
  user_email: localStorage.getItem('stratege_email') || null,
  simulation: { type_simulation: 'express' },
  etape: 1,
  biens: [],
  favoris: []
};

// ── NAVIGATION ───────────────────────────────────────────
function navTo(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    document.querySelector('.navbar')?.classList.remove('open');
  }
}

function toggleMenu() {
  document.querySelector('.navbar')?.classList.toggle('open');
}

// ── SIMULATION MULTI-ÉTAPES ──────────────────────────────
function goToEtape(n) {
  // Hide all steps
  document.querySelectorAll('.sim-etape').forEach(function(el) {
    el.classList.remove('active');
  });
  // Show target step
  var target = document.querySelector('.sim-etape[data-etape="' + n + '"]');
  if (target) target.classList.add('active');

  // Update progress indicators
  var indicators = document.querySelectorAll('.step-indicator');
  var lines = document.querySelectorAll('.step-line');

  indicators.forEach(function(el, i) {
    el.classList.remove('active', 'completed');
    if (i < n - 1) el.classList.add('completed');
    if (i === n - 1) el.classList.add('active');
  });

  // Update lines between steps
  lines.forEach(function(line, i) {
    if (i < n - 1) {
      line.classList.add('done');
    } else {
      line.classList.remove('done');
    }
  });

  state.etape = n;
}

function selectProfil(profil) {
  state.simulation.profil = profil;
  document.querySelectorAll('.profil-option').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.profil === profil);
  });
}

function selectSimType(type) {
  state.simulation.type_simulation = type;
  document.querySelectorAll('.sim-type-option').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.type === type);
  });
}

function collectInputs() {
  state.simulation.revenu_annuel = val('sim-revenu');
  state.simulation.apport = val('sim-apport');
  state.simulation.effort_mensuel = val('sim-effort');
  state.simulation.nom = val('sim-nom');
  state.simulation.email = val('sim-email');
  state.simulation.telephone = val('sim-tel');
}

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function lancerSimulation() {
  collectInputs();
  var btn = document.getElementById('btn-simuler');
  if (btn) { btn.textContent = 'Calcul en cours...'; btn.disabled = true; }

  try {
    var res = await fetch(API.simulation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.simulation)
    });
    var data = await res.json();
    if (data.success) {
      afficherResultats(data);
    } else {
      afficherResultatDemo();
    }
  } catch (err) {
    afficherResultatDemo();
  }

  goToEtape(4);
  if (btn) { btn.textContent = 'Calculer ma simulation'; btn.disabled = false; }
}

function afficherResultats(data) {
  _lastSimData = data.resultats || data;
  var r = data.resultats;
  setText('res-budget', fmt(r.budget_total) + ' \u20ac');
  setText('res-financement', fmt(r.financement_bancaire) + ' \u20ac');
  setText('res-mensualite', fmt(r.mensualite) + ' \u20ac/mois');
  setText('res-loyer', fmt(r.loyer_mensuel_estime) + ' \u20ac/mois');
  setText('res-effort', fmt(r.effort_reel) + ' \u20ac/mois');
  setText('res-rendement', r.rendement_estime + '%');
  setText('res-fiscal', fmt(r.economie_fiscale_annuelle) + ' \u20ac/an');
  setText('res-dispositif', r.dispositif);
  var simId = document.getElementById('res-simulation-id');
  if (simId) simId.value = data.simulation_id || '';
}

function afficherResultatDemo() {
  setText('res-budget', '171 000 \u20ac');
  setText('res-financement', '146 000 \u20ac');
  setText('res-mensualite', '820 \u20ac/mois');
  setText('res-loyer', '572 \u20ac/mois');
  setText('res-effort', '248 \u20ac/mois');
  setText('res-rendement', '5.8%');
  setText('res-fiscal', '2 268 \u20ac/an');
  setText('res-dispositif', 'Jeanbrun Social');
}

// ── SAVE SIMULATION ──────────────────────────────────────
var _lastSimData = null;

async function sauvegarderSimulation() {
  if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
    if (typeof showToast === 'function') showToast('Connectez-vous pour sauvegarder', 'error');
    window.location.href = 'login.html';
    return;
  }
  if (!_lastSimData) {
    if (typeof showToast === 'function') showToast('Aucune simulation à sauvegarder', 'error');
    return;
  }
  var btn = document.getElementById('btn-sauvegarder');
  if (btn) { btn.disabled = true; btn.textContent = 'Sauvegarde…'; }
  try {
    var token = typeof getToken === 'function' ? getToken() : localStorage.getItem('stratege_token');
    var res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(_lastSimData)
    });
    var data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('Simulation sauvegardée !', 'success');
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Erreur', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Erreur réseau', 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Sauvegarder'; }
}

function fmt(n) {
  return Number(n).toLocaleString('fr-FR');
}

// ── CATALOGUE DE BIENS ───────────────────────────────────
var BIENS_DEMO = [
  { id:'bien_001', titre:'Appartement T2 \u2014 Toulouse Capitole', ville:'Toulouse', surface:42, prix:189000, loyer_estime:750, rendement:5.8, dispositif:'Jeanbrun Social', mensualite:820, effort_reel:248, etage:'3\u00e8me sur 5', dpe:'B', disponible:true, tags:['Investissement','Jeanbrun','Centre-ville'] },
  { id:'bien_002', titre:'Studio meubl\u00e9 \u2014 Lyon Part-Dieu', ville:'Lyon', surface:28, prix:145000, loyer_estime:620, rendement:6.1, dispositif:'LMNP', mensualite:630, effort_reel:180, etage:'5\u00e8me sur 8', dpe:'C', disponible:true, tags:['LMNP','Meubl\u00e9','Rentabilit\u00e9'] },
  { id:'bien_003', titre:'T3 familial \u2014 Bordeaux Chartrons', ville:'Bordeaux', surface:68, prix:312000, loyer_estime:1100, rendement:4.9, dispositif:'R\u00e9sidence principale', mensualite:1380, effort_reel:1380, etage:'2\u00e8me sur 4', dpe:'A', disponible:true, tags:['R\u00e9sidence principale','Famille','Quartier pris\u00e9'] },
  { id:'bien_004', titre:'T2 neuf \u2014 Montpellier Antigone', ville:'Montpellier', surface:45, prix:198000, loyer_estime:780, rendement:5.6, dispositif:'Jeanbrun Social', mensualite:860, effort_reel:290, etage:'4\u00e8me sur 6', dpe:'A', disponible:true, tags:['Neuf','Jeanbrun','Universit\u00e9'] },
  { id:'bien_005', titre:'Studio \u2014 Nantes Centre', ville:'Nantes', surface:25, prix:125000, loyer_estime:550, rendement:6.4, dispositif:'LMNP', mensualite:540, effort_reel:155, etage:'1er sur 3', dpe:'C', disponible:false, tags:['LMNP','\u00c9tudiant','Centre-ville'] },
  { id:'bien_006', titre:'T4 standing \u2014 Paris 11\u00e8me', ville:'Paris', surface:85, prix:890000, loyer_estime:2800, rendement:3.8, dispositif:'D\u00e9ficit foncier', mensualite:3900, effort_reel:1500, etage:'6\u00e8me sur 7', dpe:'D', disponible:true, tags:['Paris','D\u00e9ficit foncier','Standing'] }
];

async function chargerBiens() {
  try {
    var res = await fetch(API.biens);
    var data = await res.json();
    if (data.success && data.biens.length > 0) {
      state.biens = data.biens;
    } else {
      state.biens = BIENS_DEMO;
    }
  } catch (err) {
    state.biens = BIENS_DEMO;
  }
  afficherBiens(state.biens);
}

function afficherBiens(biens) {
  var container = document.getElementById('catalogue-biens');
  if (!container) return;

  container.innerHTML = biens.map(function(bien) {
    return '<div class="bien-card ' + (!bien.disponible ? 'indisponible' : '') + '" data-id="' + bien.id + '">' +
      '<div class="bien-img-wrap">' +
        '<div style="font-size:48px">\ud83c\udfe0</div>' +
        (!bien.disponible ? '<span class="badge badge-warning" style="position:absolute;top:12px;left:12px">Indisponible</span>' : '') +
        '<button class="btn-favori ' + (isFavori(bien.id) ? 'active' : '') + '" onclick="toggleFavori(\'' + bien.id + '\')" title="Favoris">' +
          (isFavori(bien.id) ? '\u2764\ufe0f' : '\ud83e\udd0d') +
        '</button>' +
      '</div>' +
      '<div class="bien-body">' +
        '<div class="bien-tags">' + bien.tags.map(function(t) { return '<span class="badge badge-primary">' + t + '</span>'; }).join('') + '</div>' +
        '<h3 class="bien-titre">' + bien.titre + '</h3>' +
        '<div class="bien-stats">' +
          '<span>\ud83d\udccd ' + bien.ville + '</span>' +
          '<span>\ud83d\udcd0 ' + bien.surface + ' m\u00b2</span>' +
          '<span>DPE ' + bien.dpe + '</span>' +
        '</div>' +
        '<div class="bien-prix">' +
          '<span class="prix-principal">' + fmt(bien.prix) + ' \u20ac</span>' +
          '<span class="rendement-badge">' + bien.rendement + '% / an</span>' +
        '</div>' +
        '<div class="bien-mensualites">' +
          '<div>Mensualit\u00e9 : <strong>' + fmt(bien.mensualite) + ' \u20ac</strong></div>' +
          '<div>Effort r\u00e9el : <strong class="teal">' + fmt(bien.effort_reel) + ' \u20ac/mois</strong></div>' +
        '</div>' +
        '<div class="bien-actions">' +
          '<button class="btn-primary" onclick="ouvrirContact(\'' + bien.id + '\')">\u00catre contact\u00e9</button>' +
          '<button class="btn-ghost" onclick="simulerBien(\'' + bien.id + '\')">Simuler</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Animate cards in
  setTimeout(function() {
    container.querySelectorAll('.bien-card').forEach(function(card, i) {
      setTimeout(function() { card.classList.add('visible'); }, i * 80);
    });
  }, 50);
}

function filtrerBiens(filtre) {
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  if (event && event.target) event.target.classList.add('active');

  if (filtre === 'tous') {
    afficherBiens(state.biens);
  } else {
    var filtered = state.biens.filter(function(b) {
      return b.ville.toLowerCase() === filtre.toLowerCase() ||
             b.dispositif.toLowerCase().indexOf(filtre.toLowerCase()) !== -1 ||
             b.tags.some(function(t) { return t.toLowerCase().indexOf(filtre.toLowerCase()) !== -1; });
    });
    afficherBiens(filtered);
  }
}

function simulerBien(bien_id) {
  var section = document.getElementById('simulation');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ── FAVORIS ──────────────────────────────────────────────
function isFavori(bien_id) {
  return state.favoris.some(function(f) { return f.id === bien_id; });
}

async function toggleFavori(bien_id) {
  if (!state.user_email) {
    var email = prompt('Entrez votre email pour sauvegarder vos favoris :');
    if (!email) return;
    state.user_email = email;
    localStorage.setItem('stratege_email', email);
  }

  var bien = state.biens.find(function(b) { return b.id === bien_id; });
  if (!bien) return;

  if (isFavori(bien_id)) {
    try {
      await fetch(API.favoris, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user_email, bien_id: bien_id })
      });
    } catch (e) { /* demo mode */ }
    state.favoris = state.favoris.filter(function(f) { return f.id !== bien_id; });
  } else {
    try {
      await fetch(API.favoris, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user_email, bien: bien })
      });
    } catch (e) { /* demo mode */ }
    state.favoris.push(bien);
  }

  // Re-render with current filter
  var activeFilter = document.querySelector('.filter-btn.active');
  var currentFilter = activeFilter ? activeFilter.textContent.trim() : 'Tous';
  if (currentFilter === 'Tous') {
    afficherBiens(state.biens);
  } else {
    filtrerBiens(currentFilter);
  }
}

// ── CONTACT CONSEILLER ───────────────────────────────────
function ouvrirContact(bien_id) {
  var modale = document.getElementById('modale-contact');
  if (bien_id) {
    var h = document.getElementById('contact-bien-id');
    if (h) h.value = bien_id;
  }
  if (modale) {
    modale.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function fermerContact() {
  var modale = document.getElementById('modale-contact');
  if (modale) {
    modale.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function envoyerContact(e) {
  e.preventDefault();
  var btn = document.getElementById('btn-contact');
  if (btn) { btn.textContent = 'Envoi en cours...'; btn.disabled = true; }

  var payload = {
    nom: val('contact-nom'),
    email: val('contact-email'),
    telephone: val('contact-tel'),
    message: val('contact-message'),
    simulation_id: val('res-simulation-id') || null
  };

  try {
    var res = await fetch(API.contact, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (data.success) {
      showContactSuccess(data.reference);
      state.user_email = payload.email;
      localStorage.setItem('stratege_email', payload.email);
    } else {
      showContactSuccess('STR-DEMO');
    }
  } catch (err) {
    showContactSuccess('STR-DEMO');
  }

  if (btn) { btn.textContent = 'Envoyer ma demande'; btn.disabled = false; }
}

function showContactSuccess(reference) {
  var form = document.getElementById('contact-form');
  if (form) {
    form.innerHTML =
      '<div class="alert alert-success">' +
        '<div>' +
          '<strong>Demande envoy\u00e9e avec succ\u00e8s !</strong><br>' +
          'Un conseiller vous contactera sous 24h.<br>' +
          'R\u00e9f\u00e9rence dossier : <strong>' + reference + '</strong>' +
        '</div>' +
      '</div>' +
      '<button class="btn-primary" style="width:100%;margin-top:16px;justify-content:center" onclick="fermerContact()">Fermer</button>';
  }
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Load biens
  chargerBiens();

  // Init simulation step
  goToEtape(1);

  // Default sim type
  state.simulation.type_simulation = 'express';

  // Scroll animations (IntersectionObserver)
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up, .profile-card, .pillar, .why-box').forEach(function(el) {
    observer.observe(el);
  });

  // Close modal on overlay click
  var modale = document.getElementById('modale-contact');
  if (modale) {
    modale.addEventListener('click', function(e) {
      if (e.target === modale) fermerContact();
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') fermerContact();
  });
});

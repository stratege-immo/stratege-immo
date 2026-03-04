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
  simulation: {},
  etape: 1,
  biens: [],
  favoris: []
};

// ── SIMULATION MULTI-ÉTAPES ──────────────────────────────
function goToEtape(n) {
  document.querySelectorAll('.sim-etape').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.sim-etape[data-etape="${n}"]`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.step-indicator').forEach((el, i) => {
    el.classList.toggle('completed', i < n - 1);
    el.classList.toggle('active', i === n - 1);
  });
  state.etape = n;
}

function selectProfil(profil) {
  state.simulation.profil = profil;
  document.querySelectorAll('.profil-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.profil === profil);
  });
}

function selectSimType(type) {
  state.simulation.type_simulation = type;
  document.querySelectorAll('.sim-type-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === type);
  });
}

function collectInputs() {
  state.simulation.revenu_annuel = document.getElementById('sim-revenu')?.value || 0;
  state.simulation.apport = document.getElementById('sim-apport')?.value || 0;
  state.simulation.effort_mensuel = document.getElementById('sim-effort')?.value || 0;
  state.simulation.nom = document.getElementById('sim-nom')?.value || '';
  state.simulation.email = document.getElementById('sim-email')?.value || '';
  state.simulation.telephone = document.getElementById('sim-tel')?.value || '';
}

async function lancerSimulation() {
  collectInputs();
  const btn = document.getElementById('btn-simuler');
  if (btn) {
    btn.textContent = 'Calcul en cours...';
    btn.disabled = true;
  }

  try {
    const res = await fetch(API.simulation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.simulation)
    });
    const data = await res.json();

    if (data.success) {
      afficherResultats(data);
      goToEtape(4);
    } else {
      afficherResultatDemo();
      goToEtape(4);
    }
  } catch (err) {
    afficherResultatDemo();
    goToEtape(4);
  } finally {
    if (btn) {
      btn.textContent = 'Calculer ma simulation';
      btn.disabled = false;
    }
  }
}

function afficherResultats(data) {
  const r = data.resultats;
  setText('res-budget', r.budget_total.toLocaleString('fr-FR') + ' \u20ac');
  setText('res-financement', r.financement_bancaire.toLocaleString('fr-FR') + ' \u20ac');
  setText('res-mensualite', r.mensualite.toLocaleString('fr-FR') + ' \u20ac/mois');
  setText('res-loyer', r.loyer_mensuel_estime.toLocaleString('fr-FR') + ' \u20ac/mois');
  setText('res-effort', r.effort_reel.toLocaleString('fr-FR') + ' \u20ac/mois');
  setText('res-rendement', r.rendement_estime + '%');
  setText('res-fiscal', r.economie_fiscale_annuelle.toLocaleString('fr-FR') + ' \u20ac/an');
  setText('res-dispositif', r.dispositif);
  const simId = document.getElementById('res-simulation-id');
  if (simId) simId.value = data.simulation_id;
}

function afficherResultatDemo() {
  setText('res-budget', '171 000 \u20ac');
  setText('res-financement', '146 000 \u20ac');
  setText('res-mensualite', '820 \u20ac/mois');
  setText('res-loyer', '572 \u20ac/mois');
  setText('res-effort', '248 \u20ac/mois');
  setText('res-rendement', '5.8%');
  setText('res-fiscal', '2 268 \u20ac/an');
  setText('res-dispositif', 'Pinel Nu');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── CATALOGUE DE BIENS ───────────────────────────────────
async function chargerBiens(filtres = {}) {
  try {
    const params = new URLSearchParams(filtres);
    const res = await fetch(`${API.biens}?${params}`);
    const data = await res.json();
    if (data.success) {
      state.biens = data.biens;
      afficherBiens(data.biens);
    }
  } catch (err) {
    afficherBiensDemo();
  }
}

function afficherBiensDemo() {
  const biens = [
    { id:'bien_001', titre:'Appartement T2 \u2014 Toulouse Capitole', ville:'Toulouse', surface:42, prix:189000, loyer_estime:750, rendement:5.8, dispositif:'Pinel Nu', mensualite:820, effort_reel:248, etage:'3\u00e8me sur 5', dpe:'B', disponible:true, tags:['Investissement','Pinel','Centre-ville'] },
    { id:'bien_002', titre:'Studio meubl\u00e9 \u2014 Lyon Part-Dieu', ville:'Lyon', surface:28, prix:145000, loyer_estime:620, rendement:6.1, dispositif:'LMNP', mensualite:630, effort_reel:180, etage:'5\u00e8me sur 8', dpe:'C', disponible:true, tags:['LMNP','Meubl\u00e9','Rentabilit\u00e9'] },
    { id:'bien_003', titre:'T3 familial \u2014 Bordeaux Chartrons', ville:'Bordeaux', surface:68, prix:312000, loyer_estime:1100, rendement:4.9, dispositif:'R\u00e9sidence principale', mensualite:1380, effort_reel:1380, etage:'2\u00e8me sur 4', dpe:'A', disponible:true, tags:['R\u00e9sidence principale','Famille','Quartier pris\u00e9'] },
    { id:'bien_004', titre:'T2 neuf \u2014 Montpellier Antigone', ville:'Montpellier', surface:45, prix:198000, loyer_estime:780, rendement:5.6, dispositif:'Pinel Nu', mensualite:860, effort_reel:290, etage:'4\u00e8me sur 6', dpe:'A', disponible:true, tags:['Neuf','Pinel','Universit\u00e9'] },
    { id:'bien_005', titre:'Studio \u2014 Nantes Centre', ville:'Nantes', surface:25, prix:125000, loyer_estime:550, rendement:6.4, dispositif:'LMNP', mensualite:540, effort_reel:155, etage:'1er sur 3', dpe:'C', disponible:false, tags:['LMNP','\u00c9tudiant','Centre-ville'] },
    { id:'bien_006', titre:'T4 standing \u2014 Paris 11\u00e8me', ville:'Paris', surface:85, prix:890000, loyer_estime:2800, rendement:3.8, dispositif:'D\u00e9ficit foncier', mensualite:3900, effort_reel:1500, etage:'6\u00e8me sur 7', dpe:'D', disponible:true, tags:['Paris','D\u00e9ficit foncier','Standing'] }
  ];
  state.biens = biens;
  afficherBiens(biens);
}

function afficherBiens(biens) {
  const container = document.getElementById('catalogue-biens');
  if (!container) return;

  container.innerHTML = biens.map(bien => `
    <div class="bien-card ${!bien.disponible ? 'indisponible' : ''}" data-id="${bien.id}">
      <div class="bien-img-wrap">
        <div class="bien-img-placeholder">\ud83c\udfe0</div>
        ${!bien.disponible ? '<span class="badge badge-warning" style="position:absolute;top:12px;left:12px">Indisponible</span>' : ''}
        <button class="btn-favori ${isFavori(bien.id) ? 'active' : ''}"
          onclick="toggleFavori('${bien.id}')" title="Ajouter aux favoris">
          ${isFavori(bien.id) ? '\u2764\ufe0f' : '\ud83e\udd0d'}
        </button>
      </div>
      <div class="bien-body">
        <div class="bien-tags">
          ${bien.tags.map(t => `<span class="badge badge-primary">${t}</span>`).join('')}
        </div>
        <h3 class="bien-titre">${bien.titre}</h3>
        <div class="bien-stats">
          <span>\ud83d\udccd ${bien.ville}</span>
          <span>\ud83d\udcd0 ${bien.surface} m\u00b2</span>
          <span>\ud83c\udff7\ufe0f DPE ${bien.dpe}</span>
        </div>
        <div class="bien-prix">
          <span class="prix-principal">${bien.prix.toLocaleString('fr-FR')} \u20ac</span>
          <span class="rendement-badge">\u26a1 ${bien.rendement}% / an</span>
        </div>
        <div class="bien-mensualites">
          <div>Mensualit\u00e9 : <strong>${bien.mensualite.toLocaleString('fr-FR')} \u20ac</strong></div>
          <div>Effort r\u00e9el : <strong class="teal">${bien.effort_reel.toLocaleString('fr-FR')} \u20ac/mois</strong></div>
        </div>
        <div class="bien-actions">
          <button class="btn-primary" onclick="ouvrirContact('${bien.id}')">
            \u00catre contact\u00e9
          </button>
          <button class="btn-ghost" onclick="simulerBien('${bien.id}')">
            Simuler
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Trigger animations
  setTimeout(() => {
    container.querySelectorAll('.bien-card').forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), i * 100);
    });
  }, 100);
}

function filtrerBiens(filtre) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  if (filtre === 'tous') {
    afficherBiens(state.biens);
  } else {
    const filtered = state.biens.filter(b =>
      b.ville.toLowerCase() === filtre.toLowerCase() ||
      b.dispositif.toLowerCase().includes(filtre.toLowerCase())
    );
    afficherBiens(filtered);
  }
}

function simulerBien(bien_id) {
  const bien = state.biens.find(b => b.id === bien_id);
  if (!bien) return;
  document.getElementById('sim-apport')?.scrollIntoView({ behavior: 'smooth' });
  const section = document.getElementById('simulation');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

// ── FAVORIS ──────────────────────────────────────────────
function isFavori(bien_id) {
  return state.favoris.some(f => f.id === bien_id);
}

async function toggleFavori(bien_id) {
  if (!state.user_email) {
    const email = prompt('Entrez votre email pour sauvegarder vos favoris :');
    if (!email) return;
    state.user_email = email;
    localStorage.setItem('stratege_email', email);
  }

  const bien = state.biens.find(b => b.id === bien_id);
  if (!bien) return;

  if (isFavori(bien_id)) {
    try {
      await fetch(API.favoris, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user_email, bien_id })
      });
    } catch (e) { /* mode démo */ }
    state.favoris = state.favoris.filter(f => f.id !== bien_id);
  } else {
    try {
      await fetch(API.favoris, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user_email, bien })
      });
    } catch (e) { /* mode démo */ }
    state.favoris.push(bien);
  }
  afficherBiens(state.biens);
}

// ── CONTACT CONSEILLER ───────────────────────────────────
function ouvrirContact(bien_id) {
  const modale = document.getElementById('modale-contact');
  if (bien_id) {
    const hiddenField = document.getElementById('contact-bien-id');
    if (hiddenField) hiddenField.value = bien_id;
  }
  if (modale) {
    modale.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function fermerContact() {
  const modale = document.getElementById('modale-contact');
  if (modale) {
    modale.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function envoyerContact(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-contact');
  if (btn) {
    btn.textContent = 'Envoi en cours...';
    btn.disabled = true;
  }

  const payload = {
    nom: document.getElementById('contact-nom')?.value || '',
    email: document.getElementById('contact-email')?.value || '',
    telephone: document.getElementById('contact-tel')?.value || '',
    message: document.getElementById('contact-message')?.value || '',
    simulation_id: document.getElementById('res-simulation-id')?.value || null
  };

  try {
    const res = await fetch(API.contact, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showContactSuccess(data.reference);
      state.user_email = payload.email;
      localStorage.setItem('stratege_email', payload.email);
    }
  } catch (err) {
    showContactSuccess('STR-DEMO2024');
  } finally {
    if (btn) {
      btn.textContent = 'Envoyer ma demande';
      btn.disabled = false;
    }
  }
}

function showContactSuccess(reference) {
  const form = document.getElementById('contact-form');
  if (form) {
    form.innerHTML = `
      <div class="alert alert-success">
        <strong>Demande envoy\u00e9e !</strong><br/>
        Un conseiller vous contactera sous 24h.<br/>
        R\u00e9f\u00e9rence dossier : <strong>${reference}</strong>
      </div>
    `;
  }
}

// ── NAVBAR MOBILE ────────────────────────────────────────
function toggleMenu() {
  document.querySelector('.navbar')?.classList.toggle('open');
}

// ── SMOOTH SCROLL ────────────────────────────────────────
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    document.querySelector('.navbar')?.classList.remove('open');
  }
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  chargerBiens();
  goToEtape(1);

  // Scroll animations
  const observer = new IntersectionObserver(entries => {
    entries.forEach(el => {
      if (el.isIntersecting) {
        el.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up, .profile-card, .pillar').forEach(el => {
    observer.observe(el);
  });

  // Fermer modale en cliquant dehors
  document.getElementById('modale-contact')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fermerContact();
  });

  // Escape key closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fermerContact();
  });
});

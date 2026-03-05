/* ═══════════════════════════════════════════════════════════
   STRATÈGE — Onboarding Modal (first-time users)
   Loaded from shared.js on dashboard page
   ═══════════════════════════════════════════════════════════ */

(function() {
  // Only show on dashboard for logged-in first-time users
  if (!window.location.pathname.includes('dashboard')) return;
  if (!isLoggedIn()) return;
  if (localStorage.getItem('stratege_onboarded')) return;

  var step = 1;
  var answers = {};
  var user = getUser();
  var prenom = (user && user.prenom) ? user.prenom : 'Investisseur';

  var overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s ease';

  function renderStep() {
    var content = '';
    var dots = '';
    for (var i = 1; i <= 4; i++) {
      dots += '<div style="width:' + (i === step ? '24px' : '8px') + ';height:8px;border-radius:4px;background:' + (i === step ? '#3ECFB4' : (i < step ? '#95E8DF' : 'rgba(255,255,255,0.2)')) + ';transition:all .3s"></div>';
    }

    if (step === 1) {
      content =
        '<div style="font-size:48px;margin-bottom:16px">' +
          '<svg viewBox="0 0 36 36" fill="none" width="64" height="64"><path d="M13 2C13 2 15.5 10.5 7 13C7 13 15.5 15.5 13 24C13 24 15.5 15.5 24 13C24 13 15.5 10.5 13 2Z" fill="#3ECFB4"/><path d="M20 10C20 10 22 16.5 15.5 18.5C15.5 18.5 22 20.5 20 27C20 27 22 20.5 28.5 18.5C28.5 18.5 22 16.5 20 10Z" fill="#95E8DF"/></svg>' +
        '</div>' +
        '<h2 style="font-family:Playfair Display,serif;font-size:24px;margin-bottom:8px;color:#fff">Bienvenue ' + prenom + ' !</h2>' +
        '<p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Quel est votre objectif principal ?</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          makeOption('objectif', 'defiscaliser', 'Investir pour defiscaliser', 'Reduire mes impots') +
          makeOption('objectif', 'retraite', 'Preparer ma retraite', 'Revenus complementaires') +
          makeOption('objectif', 'residence', 'Acheter ma residence', 'Primo-accedant') +
          makeOption('objectif', 'tout', 'Tout a la fois', 'Strategie globale') +
        '</div>';
    } else if (step === 2) {
      content =
        '<h2 style="font-family:Playfair Display,serif;font-size:24px;margin-bottom:8px;color:#fff">Votre budget</h2>' +
        '<p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Quel est votre budget approximatif ?</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          makeOption('budget', '100k', 'Moins de 100 000 EUR', 'Studio / Parking') +
          makeOption('budget', '200k', '100 000 - 200 000 EUR', 'T1 / T2') +
          makeOption('budget', '350k', '200 000 - 350 000 EUR', 'T2 / T3') +
          makeOption('budget', '350k+', 'Plus de 350 000 EUR', 'T3+ / Prestige') +
        '</div>';
    } else if (step === 3) {
      content =
        '<h2 style="font-family:Playfair Display,serif;font-size:24px;margin-bottom:8px;color:#fff">Votre situation</h2>' +
        '<p style="color:rgba(255,255,255,0.7);margin-bottom:24px">Quelle est votre situation professionnelle ?</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          makeOption('situation', 'cdi', 'Salarie CDI', 'Revenus stables') +
          makeOption('situation', 'fonctionnaire', 'Fonctionnaire', 'Securite de l\'emploi') +
          makeOption('situation', 'independant', 'Independant', 'TNS / Liberal') +
          makeOption('situation', 'retraite', 'Retraite', 'Patrimoine existant') +
        '</div>';
    } else if (step === 4) {
      var reco = getRecommendation();
      content =
        '<div style="width:64px;height:64px;border-radius:50%;background:rgba(62,207,180,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ECFB4" stroke-width="2"><polyline points="22 4 12 14.01 9 11.01"/><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/></svg>' +
        '</div>' +
        '<h2 style="font-family:Playfair Display,serif;font-size:24px;margin-bottom:8px;color:#fff">Parfait !</h2>' +
        '<p style="color:rgba(255,255,255,0.7);margin-bottom:20px">Voici ce que nous vous recommandons :</p>' +
        '<div style="display:grid;gap:12px;margin-bottom:24px">' +
          reco.map(function(r) {
            return '<div style="background:rgba(62,207,180,0.1);border:1px solid rgba(62,207,180,0.3);border-radius:12px;padding:16px;text-align:left">' +
              '<div style="font-weight:600;color:#3ECFB4;margin-bottom:4px">' + r.name + '</div>' +
              '<div style="font-size:13px;color:rgba(255,255,255,0.7)">' + r.desc + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<a href="simulation.html" class="btn-primary" style="display:inline-block;text-decoration:none;padding:14px 32px;font-size:15px" onclick="finishOnboarding()">Lancer ma simulation</a>';
    }

    overlay.innerHTML =
      '<div style="background:linear-gradient(135deg,#1B2E3D,#2D3A52);border-radius:20px;padding:40px;max-width:520px;width:90%;text-align:center;position:relative;max-height:90vh;overflow-y:auto">' +
        (step > 1 && step < 4 ? '<button onclick="onboardingBack()" style="position:absolute;top:16px;left:16px;background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:14px">&larr; Retour</button>' : '') +
        '<button onclick="finishOnboarding()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:18px">&times;</button>' +
        content +
        '<div style="display:flex;gap:6px;justify-content:center;margin-top:24px">' + dots + '</div>' +
      '</div>';
  }

  function makeOption(key, value, title, subtitle) {
    var selected = answers[key] === value;
    return '<div onclick="onboardingSelect(\'' + key + '\',\'' + value + '\')" style="padding:16px;border:2px solid ' + (selected ? '#3ECFB4' : 'rgba(255,255,255,0.15)') + ';border-radius:12px;cursor:pointer;transition:all .2s;background:' + (selected ? 'rgba(62,207,180,0.1)' : 'transparent') + '">' +
      '<div style="font-weight:600;color:#fff;font-size:14px">' + title + '</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">' + subtitle + '</div>' +
    '</div>';
  }

  function getRecommendation() {
    var recos = [];
    var obj = answers.objectif || '';
    var budget = answers.budget || '';

    if (obj === 'defiscaliser' || obj === 'tout') {
      if (budget === '100k' || budget === '200k') {
        recos.push({ name: 'Jeanbrun Social — Zone B1', desc: 'Reduction d\'impot jusqu\'a 23% sur 12 ans. Ideal pour les budgets de 100k a 200k.' });
      } else {
        recos.push({ name: 'Jeanbrun Social — Zone A', desc: 'Reduction d\'impot jusqu\'a 28% sur 12 ans. Fort potentiel de valorisation.' });
      }
    }
    if (obj === 'retraite' || obj === 'tout') {
      recos.push({ name: 'SCPI — Iroko Zen / Corum', desc: 'Revenus passifs de 5 a 7% par an. Gestion 100% deleguee, ideal retraite.' });
    }
    if (obj === 'residence') {
      recos.push({ name: 'Pret immobilier optimise', desc: 'Simulation de votre capacite d\'emprunt avec les meilleurs taux du marche.' });
    }
    if (recos.length === 0) {
      recos.push({ name: 'Bilan patrimonial gratuit', desc: 'Un conseiller analyse votre situation et vous propose une strategie sur-mesure.' });
    }
    if (answers.situation === 'independant') {
      recos.push({ name: 'LMNP — Amortissement', desc: 'Particulierement adapte aux TNS : revenus locatifs peu fiscalises grace a l\'amortissement.' });
    }
    return recos.slice(0, 2);
  }

  // Global functions
  window.onboardingSelect = function(key, value) {
    answers[key] = value;
    step++;
    renderStep();
  };

  window.onboardingBack = function() {
    if (step > 1) { step--; renderStep(); }
  };

  window.finishOnboarding = function() {
    localStorage.setItem('stratege_onboarded', 'true');
    overlay.remove();
    // Save answers to user profile if possible
    if (isLoggedIn()) {
      try {
        var u = getUser();
        if (u) {
          u.onboarding = answers;
          localStorage.setItem('stratege_user', JSON.stringify(u));
        }
      } catch(e) {}
    }
  };

  // Render and show
  renderStep();
  document.body.appendChild(overlay);
})();

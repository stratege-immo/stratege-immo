const BIENS_CATALOGUE = [
  {
    id: 'bien_001',
    titre: 'Appartement T2 — Toulouse Capitole',
    ville: 'Toulouse',
    surface: 42,
    prix: 189000,
    loyer_estime: 750,
    rendement: 5.8,
    dispositif: 'Jeanbrun Social',
    mensualite: 820,
    effort_reel: 248,
    etage: '3ème sur 5',
    dpe: 'B',
    disponible: true,
    tags: ['Investissement', 'Jeanbrun', 'Centre-ville']
  },
  {
    id: 'bien_002',
    titre: 'Studio meublé — Lyon Part-Dieu',
    ville: 'Lyon',
    surface: 28,
    prix: 145000,
    loyer_estime: 620,
    rendement: 6.1,
    dispositif: 'LMNP',
    mensualite: 630,
    effort_reel: 180,
    etage: '5ème sur 8',
    dpe: 'C',
    disponible: true,
    tags: ['LMNP', 'Meublé', 'Rentabilité']
  },
  {
    id: 'bien_003',
    titre: 'T3 familial — Bordeaux Chartrons',
    ville: 'Bordeaux',
    surface: 68,
    prix: 312000,
    loyer_estime: 1100,
    rendement: 4.9,
    dispositif: 'Résidence principale',
    mensualite: 1380,
    effort_reel: 1380,
    etage: '2ème sur 4',
    dpe: 'A',
    disponible: true,
    tags: ['Résidence principale', 'Famille', 'Quartier prisé']
  },
  {
    id: 'bien_004',
    titre: 'T2 neuf — Montpellier Antigone',
    ville: 'Montpellier',
    surface: 45,
    prix: 198000,
    loyer_estime: 780,
    rendement: 5.6,
    dispositif: 'Jeanbrun Social',
    mensualite: 860,
    effort_reel: 290,
    etage: '4ème sur 6',
    dpe: 'A',
    disponible: true,
    tags: ['Neuf', 'Jeanbrun', 'Université']
  },
  {
    id: 'bien_005',
    titre: 'Studio — Nantes Centre',
    ville: 'Nantes',
    surface: 25,
    prix: 125000,
    loyer_estime: 550,
    rendement: 6.4,
    dispositif: 'LMNP',
    mensualite: 540,
    effort_reel: 155,
    etage: '1er sur 3',
    dpe: 'C',
    disponible: false,
    tags: ['LMNP', 'Étudiant', 'Centre-ville']
  },
  {
    id: 'bien_006',
    titre: 'T4 standing — Paris 11ème',
    ville: 'Paris',
    surface: 85,
    prix: 890000,
    loyer_estime: 2800,
    rendement: 3.8,
    dispositif: 'Déficit foncier',
    mensualite: 3900,
    effort_reel: 1500,
    etage: '6ème sur 7',
    dpe: 'D',
    disponible: true,
    tags: ['Paris', 'Déficit foncier', 'Standing']
  }
];

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const ville = url.searchParams.get('ville');
  const dispositif = url.searchParams.get('dispositif');
  const prix_max = url.searchParams.get('prix_max');

  let biens = [...BIENS_CATALOGUE];

  if (ville) biens = biens.filter(b => b.ville.toLowerCase() === ville.toLowerCase());
  if (dispositif) biens = biens.filter(b => b.dispositif.toLowerCase().includes(dispositif.toLowerCase()));
  if (prix_max) biens = biens.filter(b => b.prix <= parseFloat(prix_max));

  return new Response(JSON.stringify({
    success: true,
    total: biens.length,
    biens
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

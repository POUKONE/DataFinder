export type Dataset = {
  id: string;
  title: string;
  provider: string;
  sourceType: string;
  description: string;
  domain: string;
  country: string;
  period: string;
  formats: string[];
  license: string;
  update: string;
  score: number;
  size: string;
  access: string;
  variables: string[];
  url: string;
  tags: string[];
  accent: string;
};

export const datasets: Dataset[] = [
  {
    id: "dvf",
    title: "Demandes de valeurs foncières",
    provider: "DGFiP · data.gouv.fr",
    sourceType: "Gouvernement",
    description: "Transactions immobilières enregistrées en France : prix, dates, surfaces, nature des biens et localisation cadastrale.",
    domain: "Immobilier",
    country: "France",
    period: "5 dernières années",
    formats: ["CSV", "TXT"],
    license: "Licence Ouverte 2.0",
    update: "Semestrielle",
    score: 96,
    size: "≈ 400 Mo / an",
    access: "Téléchargement direct",
    variables: ["valeur foncière", "date de mutation", "type de local", "surface", "commune"],
    url: "https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres",
    tags: ["Meilleur choix", "Source officielle"],
    accent: "#6d5dfc",
  },
  {
    id: "wdi-youth",
    title: "Chômage des jeunes (15–24 ans)",
    provider: "Banque mondiale · WDI",
    sourceType: "Institution",
    description: "Taux de chômage annuel des jeunes, estimations modélisées de l’OIT, avec ventilation par sexe et couverture mondiale.",
    domain: "Économie",
    country: "Monde",
    period: "1991–2025",
    formats: ["API", "CSV", "XLSX"],
    license: "CC BY 4.0",
    update: "Annuelle",
    score: 95,
    size: "Léger",
    access: "API sans clé",
    variables: ["pays", "année", "taux total", "taux femmes", "taux hommes"],
    url: "https://data.worldbank.org/indicator/SL.UEM.1524.ZS",
    tags: ["Meilleure API", "Power BI"],
    accent: "#0d9f85",
  },
  {
    id: "open-meteo",
    title: "Open-Meteo Historical Weather",
    provider: "Open-Meteo",
    sourceType: "API",
    description: "Données météorologiques historiques et prévisions mondiales, requêtables par coordonnées et sans clé pour un usage non commercial.",
    domain: "Météo",
    country: "Monde",
    period: "1940–aujourd’hui",
    formats: ["API", "JSON", "CSV"],
    license: "CC BY 4.0",
    update: "Temps réel",
    score: 92,
    size: "À la demande",
    access: "API sans clé",
    variables: ["température", "précipitations", "vent", "humidité", "rayonnement"],
    url: "https://open-meteo.com/en/docs/historical-weather-api",
    tags: ["Temps réel", "Développeurs"],
    accent: "#3387e8",
  },
  {
    id: "eurostat",
    title: "Eurostat Data Browser",
    provider: "Commission européenne",
    sourceType: "Institution",
    description: "Catalogue statistique européen couvrant la population, l’économie, l’environnement, l’industrie et les territoires.",
    domain: "Statistiques",
    country: "Europe",
    period: "Variable",
    formats: ["API", "CSV", "XLSX", "JSON"],
    license: "Réutilisation Eurostat",
    update: "Selon l’indicateur",
    score: 91,
    size: "Variable",
    access: "API et export",
    variables: ["pays", "période", "indicateur", "unité", "valeur"],
    url: "https://ec.europa.eu/eurostat/databrowser/",
    tags: ["Source officielle", "Très documenté"],
    accent: "#f0a629",
  },
  {
    id: "uci-adult",
    title: "Adult Census Income",
    provider: "UCI Machine Learning Repository",
    sourceType: "Recherche",
    description: "Jeu de classification de référence visant à prédire si le revenu annuel d’une personne dépasse 50 000 dollars.",
    domain: "Machine learning",
    country: "États-Unis",
    period: "1994",
    formats: ["CSV"],
    license: "CC BY 4.0",
    update: "Archive stable",
    score: 87,
    size: "48 842 lignes",
    access: "Téléchargement direct",
    variables: ["âge", "éducation", "profession", "heures", "revenu"],
    url: "https://archive.ics.uci.edu/dataset/2/adult",
    tags: ["Machine learning", "Débutants"],
    accent: "#e65e79",
  },
  {
    id: "ilostat",
    title: "ILOSTAT Bulk Data",
    provider: "Organisation internationale du Travail",
    sourceType: "Institution",
    description: "Indicateurs mondiaux du travail : emploi, chômage, salaires, protection sociale et conditions de travail.",
    domain: "Emploi",
    country: "Monde",
    period: "Variable",
    formats: ["CSV", "API"],
    license: "CC BY 4.0",
    update: "Régulière",
    score: 94,
    size: "Variable",
    access: "Téléchargement en masse",
    variables: ["indicateur", "sexe", "âge", "pays", "année", "valeur"],
    url: "https://ilostat.ilo.org/data/bulk/",
    tags: ["Source officielle", "Recherche"],
    accent: "#9365d8",
  },
];

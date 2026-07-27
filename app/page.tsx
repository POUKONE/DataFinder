"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Dataset = {
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

const datasets: Dataset[] = [
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

const popular = ["Immobilier en France", "Chômage des jeunes", "Météo historique", "Fraude bancaire"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [format, setFormat] = useState("Tous les formats");
  const [source, setSource] = useState("Toutes les sources");
  const [license, setLicense] = useState("Toutes les licences");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [selected, setSelected] = useState<Dataset | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("datafinder-favorites");
    window.setTimeout(() => {
      if (saved) {
        try { setFavorites(JSON.parse(saved)); } catch { window.localStorage.removeItem("datafinder-favorites"); }
      }
      setFavoritesLoaded(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (favoritesLoaded) window.localStorage.setItem("datafinder-favorites", JSON.stringify(favorites));
  }, [favorites, favoritesLoaded]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return datasets.filter((dataset) => {
      const searchable = [dataset.title, dataset.provider, dataset.description, dataset.domain, dataset.country, ...dataset.variables].join(" ").toLowerCase();
      return (words.length === 0 || words.every((word) => searchable.includes(word))) &&
        (format === "Tous les formats" || dataset.formats.includes(format)) &&
        (source === "Toutes les sources" || dataset.sourceType === source) &&
        (license === "Toutes les licences" || dataset.license.includes(license)) &&
        (!favoritesOnly || favorites.includes(dataset.id));
    }).sort((a, b) => b.score - a.score);
  }, [query, format, source, license, favoritesOnly, favorites]);

  function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setSearched(true);
    window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function choosePopular(value: string) {
    setQuery(value);
    setSearched(true);
    window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleCompare(id: string) {
    setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  const comparison = datasets.filter((item) => compare.includes(item.id));

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="DataFinder, accueil">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Data<span>Finder</span></span>
        </a>
        <nav aria-label="Navigation principale">
          <a href="#discover">Explorer</a>
          <button className={favoritesOnly ? "nav-active" : ""} onClick={() => { setFavoritesOnly(!favoritesOnly); setSearched(true); }}>Favoris <b>{favorites.length}</b></button>
          <a href="#how">Comment ça marche</a>
        </nav>
        <button className="avatar" aria-label="Espace utilisateur">PK</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="eyebrow"><span>✦</span> Recherche intelligente de données</div>
        <h1>Les bonnes données.<br /><em>Sans perdre des heures.</em></h1>
        <p>Décrivez votre projet. DataFinder compare les sources, vérifie les licences et classe les datasets réellement exploitables.</p>

        <form className="search-panel" onSubmit={runSearch}>
          <div className="main-search">
            <span className="search-icon" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. prix immobiliers en France pour Power BI…" aria-label="Décrivez les données recherchées" />
            <button type="submit">Rechercher <span>→</span></button>
          </div>
          <div className="filters" aria-label="Filtres de recherche">
            <label>Format
              <select value={format} onChange={(event) => { setFormat(event.target.value); setSearched(true); }}>
                <option>Tous les formats</option><option>CSV</option><option>API</option><option>JSON</option><option>XLSX</option>
              </select>
            </label>
            <label>Source
              <select value={source} onChange={(event) => { setSource(event.target.value); setSearched(true); }}>
                <option>Toutes les sources</option><option>Gouvernement</option><option>Institution</option><option>API</option><option>Recherche</option>
              </select>
            </label>
            <label>Licence
              <select value={license} onChange={(event) => { setLicense(event.target.value); setSearched(true); }}>
                <option>Toutes les licences</option><option>CC BY</option><option>Ouverte</option>
              </select>
            </label>
          </div>
        </form>

        <div className="popular-row">
          <span>Recherches populaires</span>
          {popular.map((item) => <button key={item} onClick={() => choosePopular(item)}>{item}</button>)}
        </div>
      </section>

      <section className="trust-strip" aria-label="Indicateurs DataFinder">
        <div><strong>240K+</strong><span>datasets indexés</span></div>
        <div><strong>1 200+</strong><span>sources vérifiées</span></div>
        <div><strong>96%</strong><span>de liens actifs</span></div>
        <div><strong>18</strong><span>domaines couverts</span></div>
      </section>

      <section className="discover" id="discover">
        <div className="section-heading">
          <div><span className="section-kicker">SÉLECTION DATAFINDER</span><h2>{searched ? `${results.length} résultats pertinents` : "Des données prêtes à servir"}</h2></div>
          {searched && <button className="reset" onClick={() => { setQuery(""); setFormat("Tous les formats"); setSource("Toutes les sources"); setLicense("Toutes les licences"); setFavoritesOnly(false); }}>Réinitialiser les filtres</button>}
        </div>

        <div className="results-grid" id="results">
          {results.map((dataset, index) => (
            <article className="dataset-card" key={dataset.id} style={{ "--accent": dataset.accent } as React.CSSProperties}>
              <div className="card-top">
                <div className="source-logo">{dataset.provider.split(" ")[0].slice(0, 2).toUpperCase()}</div>
                <div className="score"><span>{index === 0 ? "Meilleur match" : "Score"}</span><strong>{dataset.score}</strong><small>/100</small></div>
              </div>
              <div className="tag-row">{dataset.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
              <h3>{dataset.title}</h3>
              <p className="provider">{dataset.provider}</p>
              <p className="description">{dataset.description}</p>
              <div className="metadata">
                <span>⌖ {dataset.country}</span><span>◷ {dataset.period}</span><span>↻ {dataset.update}</span>
              </div>
              <div className="format-row">{dataset.formats.map((item) => <span key={item}>{item}</span>)}<span className="license">{dataset.license}</span></div>
              <div className="card-actions">
                <button className="view" onClick={() => setSelected(dataset)}>Voir la fiche <span>→</span></button>
                <button className={compare.includes(dataset.id) ? "icon-button active" : "icon-button"} onClick={() => toggleCompare(dataset.id)} aria-label={`Comparer ${dataset.title}`} title="Comparer">⇄</button>
                <button className={favorites.includes(dataset.id) ? "icon-button active heart" : "icon-button heart"} onClick={() => toggleFavorite(dataset.id)} aria-label={`Ajouter ${dataset.title} aux favoris`} title="Favori">{favorites.includes(dataset.id) ? "♥" : "♡"}</button>
              </div>
            </article>
          ))}
        </div>
        {results.length === 0 && <div className="empty"><span>⌕</span><h3>Aucun dataset ne correspond exactement.</h3><p>Essayez un domaine plus large ou réinitialisez les filtres.</p></div>}
      </section>

      <section className="how" id="how">
        <div className="how-copy"><span className="section-kicker">COMMENT ÇA MARCHE</span><h2>De la question au bon dataset, en trois contrôles.</h2><p>Chaque résultat est analysé pour réduire le temps passé à vérifier les métadonnées et les conditions d’utilisation.</p></div>
        <div className="steps">
          <div><b>01</b><span className="step-symbol">⌕</span><h3>Compréhension</h3><p>Domaine, pays, période, variables et usage sont extraits de votre demande.</p></div>
          <div><b>02</b><span className="step-symbol">✓</span><h3>Vérification</h3><p>Source, fraîcheur, documentation, accès et licence sont contrôlés.</p></div>
          <div><b>03</b><span className="step-symbol">↗</span><h3>Recommandation</h3><p>Les meilleurs choix sont classés et expliqués selon votre projet.</p></div>
        </div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span><span>Data<span>Finder</span></span></a><p>Les données qui font avancer vos projets.</p><span>Catalogue de démonstration · 2026</span></footer>

      {compare.length > 0 && <div className="compare-bar"><div><span>{compare.length}</span><p><strong>Dataset{compare.length > 1 ? "s" : ""} sélectionné{compare.length > 1 ? "s" : ""}</strong><small>Vous pouvez en comparer jusqu’à 3</small></p></div><button onClick={() => setShowCompare(true)} disabled={compare.length < 2}>Comparer maintenant</button><button className="close-compare" onClick={() => setCompare([])} aria-label="Vider la comparaison">×</button></div>}

      {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="detail-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="detail-title">
        <button className="modal-close" onClick={() => setSelected(null)} aria-label="Fermer">×</button>
        <div className="detail-head" style={{ "--accent": selected.accent } as React.CSSProperties}><div className="source-logo">{selected.provider.slice(0, 2).toUpperCase()}</div><div><span>{selected.tags[0]}</span><h2 id="detail-title">{selected.title}</h2><p>{selected.provider}</p></div><div className="large-score"><strong>{selected.score}</strong><small>/100</small><span>Très pertinent</span></div></div>
        <p className="detail-description">{selected.description}</p>
        <div className="detail-grid"><div><span>Couverture</span><strong>{selected.country}</strong><small>{selected.period}</small></div><div><span>Formats</span><strong>{selected.formats.join(", ")}</strong><small>{selected.size}</small></div><div><span>Mise à jour</span><strong>{selected.update}</strong><small>{selected.access}</small></div><div><span>Licence</span><strong>{selected.license}</strong><small>Vérifier les conditions</small></div></div>
        <div className="variables"><h3>Variables principales</h3><div>{selected.variables.map((variable) => <span key={variable}>{variable}</span>)}</div></div>
        <div className="detail-note"><b>i</b><p><strong>Pourquoi ce résultat ?</strong> Source identifiable, accès documenté et format exploitable. Le score combine pertinence, fiabilité, fraîcheur, licence et facilité d’usage.</p></div>
        <div className="modal-actions"><button onClick={() => toggleFavorite(selected.id)}>{favorites.includes(selected.id) ? "♥ Retirer des favoris" : "♡ Ajouter aux favoris"}</button><a href={selected.url} target="_blank" rel="noreferrer">Accéder à la source officielle ↗</a></div>
      </section></div>}

      {showCompare && <div className="modal-backdrop" onMouseDown={() => setShowCompare(false)}><section className="compare-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="compare-title"><button className="modal-close" onClick={() => setShowCompare(false)} aria-label="Fermer">×</button><span className="section-kicker">COMPARATEUR</span><h2 id="compare-title">Comparez avant de choisir</h2><div className="comparison-table"><div className="comparison-labels"><span>Dataset</span><span>Score</span><span>Formats</span><span>Licence</span><span>Couverture</span><span>Accès</span></div>{comparison.map((item) => <div className="comparison-column" key={item.id}><strong>{item.title}</strong><span className="compare-score">{item.score}/100</span><span>{item.formats.join(", ")}</span><span>{item.license}</span><span>{item.country}<small>{item.period}</small></span><span>{item.access}</span><a href={item.url} target="_blank" rel="noreferrer">Ouvrir ↗</a></div>)}</div></section></div>}
    </main>
  );
}

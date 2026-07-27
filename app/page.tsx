"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Dataset, DatasetInput, PaginatedDatasets } from "@/lib/datasets";
import { MAX_PAGE_SIZE } from "@/lib/pagination";
import type { WebResult } from "@/lib/webSearch";

const popular = ["Immobilier en France", "Chômage des jeunes", "Météo historique", "Fraude bancaire"];
const RESULTS_PER_PAGE = 6;

type DatasetFormState = {
  title: string; provider: string; sourceType: string; description: string; domain: string;
  country: string; period: string; formats: string; license: string; update: string;
  score: string; size: string; access: string; variables: string; url: string; tags: string; accent: string;
};

const emptyForm: DatasetFormState = {
  title: "", provider: "", sourceType: "", description: "", domain: "",
  country: "", period: "", formats: "", license: "", update: "",
  score: "", size: "", access: "", variables: "", url: "", tags: "", accent: "#6d5dfc",
};

function datasetToForm(dataset: Dataset): DatasetFormState {
  return {
    title: dataset.title, provider: dataset.provider, sourceType: dataset.sourceType,
    description: dataset.description, domain: dataset.domain, country: dataset.country,
    period: dataset.period, formats: dataset.formats.join(", "), license: dataset.license,
    update: dataset.update, score: String(dataset.score), size: dataset.size, access: dataset.access,
    variables: dataset.variables.join(", "), url: dataset.url, tags: dataset.tags.join(", "), accent: dataset.accent,
  };
}

function formToInput(form: DatasetFormState): DatasetInput {
  return {
    title: form.title.trim(), provider: form.provider.trim(), sourceType: form.sourceType.trim(),
    description: form.description.trim(), domain: form.domain.trim(), country: form.country.trim(),
    period: form.period.trim(), formats: form.formats.split(",").map((v) => v.trim()).filter(Boolean),
    license: form.license.trim(), update: form.update.trim(), score: Number(form.score),
    size: form.size.trim(), access: form.access.trim(),
    variables: form.variables.split(",").map((v) => v.trim()).filter(Boolean),
    url: form.url.trim(), tags: form.tags.split(",").map((v) => v.trim()).filter(Boolean), accent: form.accent.trim(),
  };
}

export default function Home() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [datasetsError, setDatasetsError] = useState(false);
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
  const [page, setPage] = useState(1);

  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const isAdmin = apiKey.trim().length > 0;

  const [formModal, setFormModal] = useState<{ mode: "create" | "edit"; dataset?: Dataset } | null>(null);
  const [formState, setFormState] = useState<DatasetFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<WebResult[]>([]);
  const [webSearching, setWebSearching] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);

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

  useEffect(() => {
    const saved = window.sessionStorage.getItem("datafinder-api-key");
    window.setTimeout(() => {
      if (saved) setApiKey(saved);
      setApiKeyLoaded(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!apiKeyLoaded) return;
    if (apiKey) window.sessionStorage.setItem("datafinder-api-key", apiKey);
    else window.sessionStorage.removeItem("datafinder-api-key");
  }, [apiKey, apiKeyLoaded]);

  async function loadDatasets() {
    setDatasetsLoading(true);
    setDatasetsError(false);
    try {
      const response = await fetch(`/api/datasets?pageSize=${MAX_PAGE_SIZE}`);
      if (!response.ok) throw new Error("request failed");
      const payload: PaginatedDatasets = await response.json();
      setDatasets(payload.data);
    } catch {
      setDatasetsError(true);
    } finally {
      setDatasetsLoading(false);
    }
  }

  useEffect(() => { window.setTimeout(() => { loadDatasets(); }, 0); }, []);

  function handleUnauthorized() {
    setApiKey("");
    window.alert("Clé API invalide ou manquante. Reconnectez-vous via l'espace admin.");
  }

  function openCreateForm() {
    setFormState(emptyForm);
    setFormError(null);
    setFormModal({ mode: "create" });
  }

  function openEditForm(dataset: Dataset) {
    setFormState(datasetToForm(dataset));
    setFormError(null);
    setFormModal({ mode: "edit", dataset });
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    try {
      const input = formToInput(formState);
      const isEdit = formModal?.mode === "edit";
      const url = isEdit ? `/api/datasets/${formModal.dataset!.id}` : "/api/datasets";
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(input),
      });
      if (response.status === 401 || response.status === 503) {
        setShowAdminPanel(false);
        setFormModal(null);
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFormError(payload?.details?.join(" ") || payload?.error || "Une erreur est survenue.");
        return;
      }
      setFormModal(null);
      await loadDatasets();
    } catch {
      setFormError("Impossible de contacter le serveur.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(dataset: Dataset) {
    if (!window.confirm(`Supprimer « ${dataset.title} » ? Cette action est irréversible.`)) return;
    const response = await fetch(`/api/datasets/${dataset.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401 || response.status === 503) {
      handleUnauthorized();
      return;
    }
    if (!response.ok && response.status !== 204) {
      window.alert("La suppression a échoué.");
      return;
    }
    await loadDatasets();
  }

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
  }, [datasets, query, format, source, license, favoritesOnly, favorites]);

  const totalPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedResults = results.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE);

  useEffect(() => { window.setTimeout(() => setPage(1), 0); }, [query, format, source, license, favoritesOnly]);

  async function runWebSearch(rawQuery: string) {
    const trimmed = rawQuery.trim();
    setWebQuery(trimmed);
    if (!trimmed) {
      setWebResults([]);
      setWebError(null);
      return;
    }
    setWebSearching(true);
    setWebError(null);
    try {
      const response = await fetch(`/api/web-search?q=${encodeURIComponent(trimmed)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setWebResults([]);
        setWebError(payload?.error || "La recherche web a échoué.");
        return;
      }
      setWebResults(payload.results ?? []);
    } catch {
      setWebResults([]);
      setWebError("Impossible de contacter le serveur.");
    } finally {
      setWebSearching(false);
    }
  }

  function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setSearched(true);
    runWebSearch(query);
    window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function choosePopular(value: string) {
    setQuery(value);
    setSearched(true);
    runWebSearch(value);
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
        <button
          className={isAdmin ? "avatar avatar-active" : "avatar"}
          aria-label="Espace admin"
          title={isAdmin ? "Connecté en tant qu'admin" : "Se connecter en tant qu'admin"}
          onClick={() => { setApiKeyDraft(apiKey); setShowAdminPanel(true); }}
        >PK</button>
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
          <div className="heading-actions">
            {isAdmin && <button className="add-dataset" onClick={openCreateForm}>+ Ajouter un dataset</button>}
            {searched && <button className="reset" onClick={() => { setQuery(""); setFormat("Tous les formats"); setSource("Toutes les sources"); setLicense("Toutes les licences"); setFavoritesOnly(false); }}>Réinitialiser les filtres</button>}
          </div>
        </div>

        {datasetsLoading && <div className="empty"><span>⌕</span><h3>Chargement des datasets…</h3></div>}
        {datasetsError && <div className="empty"><span>⌕</span><h3>Impossible de charger les datasets.</h3><p>Vérifiez que l&apos;API /api/datasets répond, puis rechargez la page.</p></div>}

        {!datasetsLoading && !datasetsError && <div className="results-grid" id="results">
          {pagedResults.map((dataset, index) => {
            const globalIndex = (currentPage - 1) * RESULTS_PER_PAGE + index;
            return (
            <article className="dataset-card" key={dataset.id} style={{ "--accent": dataset.accent } as React.CSSProperties}>
              <div className="card-top">
                <div className="source-logo">{dataset.provider.split(" ")[0].slice(0, 2).toUpperCase()}</div>
                <div className="score"><span>{globalIndex === 0 ? "Meilleur match" : "Score"}</span><strong>{dataset.score}</strong><small>/100</small></div>
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
                {isAdmin && <button className="icon-button" onClick={() => openEditForm(dataset)} aria-label={`Éditer ${dataset.title}`} title="Éditer">✎</button>}
                {isAdmin && <button className="icon-button danger" onClick={() => handleDelete(dataset)} aria-label={`Supprimer ${dataset.title}`} title="Supprimer">✕</button>}
              </div>
            </article>
            );
          })}
        </div>}
        {!datasetsLoading && !datasetsError && results.length === 0 && <div className="empty"><span>⌕</span><h3>Aucun dataset ne correspond exactement.</h3><p>Essayez un domaine plus large ou réinitialisez les filtres.</p></div>}
        {!datasetsLoading && !datasetsError && results.length > 0 && totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>← Précédent</button>
            <span>Page {currentPage} / {totalPages}</span>
            <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Suivant →</button>
          </div>
        )}
      </section>

      {searched && webQuery && (
        <section className="web-results" id="web-results">
          <div className="section-heading">
            <div><span className="section-kicker">DATASETS TROUVÉS SUR LE WEB</span><h2>Résultats pour « {webQuery} »</h2></div>
          </div>

          {webSearching && <div className="empty"><span>⌕</span><h3>Recherche de datasets sur le web…</h3></div>}
          {!webSearching && webError && <div className="empty"><span>⌕</span><h3>Recherche web indisponible</h3><p>{webError}</p></div>}
          {!webSearching && !webError && webResults.length === 0 && <div className="empty"><span>⌕</span><h3>Aucun dataset trouvé sur le web pour cette recherche.</h3></div>}

          {!webSearching && !webError && webResults.length > 0 && (
            <div className="web-results-list">
              {webResults.map((result) => (
                <a className="web-result" key={result.url} href={result.url} target="_blank" rel="noreferrer">
                  <span className="web-result-url">{result.url}</span>
                  <h3>{result.title}</h3>
                  <p>{result.description}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

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

      {showAdminPanel && (
        <div className="modal-backdrop" onMouseDown={() => setShowAdminPanel(false)}>
          <section className="admin-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="admin-title">
            <button className="modal-close" onClick={() => setShowAdminPanel(false)} aria-label="Fermer">×</button>
            <span className="section-kicker">ESPACE ADMIN</span>
            <h2 id="admin-title">{isAdmin ? "Connecté" : "Se connecter"}</h2>
            <p>Collez votre clé API (<code>DATAFINDER_API_KEY</code>) pour activer la création, l&apos;édition et la suppression de datasets.</p>
            <form onSubmit={(event) => { event.preventDefault(); setApiKey(apiKeyDraft.trim()); setShowAdminPanel(false); }}>
              <input
                type="password"
                value={apiKeyDraft}
                onChange={(event) => setApiKeyDraft(event.target.value)}
                placeholder="Clé API"
                aria-label="Clé API"
                autoFocus
              />
              <div className="modal-actions">
                {isAdmin && <button type="button" onClick={() => { setApiKey(""); setApiKeyDraft(""); setShowAdminPanel(false); }}>Se déconnecter</button>}
                <button type="submit" className="primary">Enregistrer</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {formModal && (
        <div className="modal-backdrop" onMouseDown={() => setFormModal(null)}>
          <section className="detail-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="form-title">
            <button className="modal-close" onClick={() => setFormModal(null)} aria-label="Fermer">×</button>
            <span className="section-kicker">{formModal.mode === "create" ? "NOUVEAU DATASET" : "MODIFIER LE DATASET"}</span>
            <h2 id="form-title">{formModal.mode === "create" ? "Ajouter un dataset" : formModal.dataset?.title}</h2>
            <form className="dataset-form" onSubmit={submitForm}>
              <label>Titre<input value={formState.title} onChange={(e) => setFormState({ ...formState, title: e.target.value })} required /></label>
              <label>Fournisseur<input value={formState.provider} onChange={(e) => setFormState({ ...formState, provider: e.target.value })} required /></label>
              <label>Type de source<input value={formState.sourceType} onChange={(e) => setFormState({ ...formState, sourceType: e.target.value })} placeholder="Gouvernement, Institution, API, Recherche…" required /></label>
              <label>Domaine<input value={formState.domain} onChange={(e) => setFormState({ ...formState, domain: e.target.value })} required /></label>
              <label>Pays / couverture<input value={formState.country} onChange={(e) => setFormState({ ...formState, country: e.target.value })} required /></label>
              <label>Période<input value={formState.period} onChange={(e) => setFormState({ ...formState, period: e.target.value })} required /></label>
              <label>Licence<input value={formState.license} onChange={(e) => setFormState({ ...formState, license: e.target.value })} required /></label>
              <label>Fréquence de mise à jour<input value={formState.update} onChange={(e) => setFormState({ ...formState, update: e.target.value })} required /></label>
              <label>Taille<input value={formState.size} onChange={(e) => setFormState({ ...formState, size: e.target.value })} required /></label>
              <label>Accès<input value={formState.access} onChange={(e) => setFormState({ ...formState, access: e.target.value })} required /></label>
              <label>Score (0-100)<input type="number" min={0} max={100} value={formState.score} onChange={(e) => setFormState({ ...formState, score: e.target.value })} required /></label>
              <label>Couleur d&apos;accent<input type="color" value={formState.accent} onChange={(e) => setFormState({ ...formState, accent: e.target.value })} /></label>
              <label className="full">URL source<input type="url" value={formState.url} onChange={(e) => setFormState({ ...formState, url: e.target.value })} required /></label>
              <label className="full">Description<textarea value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} required /></label>
              <label className="full">Formats (séparés par des virgules)<input value={formState.formats} onChange={(e) => setFormState({ ...formState, formats: e.target.value })} placeholder="CSV, API, JSON" required /></label>
              <label className="full">Variables (séparées par des virgules)<input value={formState.variables} onChange={(e) => setFormState({ ...formState, variables: e.target.value })} placeholder="pays, année, valeur" required /></label>
              <label className="full">Tags (séparés par des virgules)<input value={formState.tags} onChange={(e) => setFormState({ ...formState, tags: e.target.value })} placeholder="Source officielle, Recherche" required /></label>

              {formError && <p className="form-error full">{formError}</p>}

              <div className="modal-actions full">
                <button type="button" onClick={() => setFormModal(null)}>Annuler</button>
                <button type="submit" className="primary" disabled={formSubmitting}>{formSubmitting ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

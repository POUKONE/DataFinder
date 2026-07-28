# DataFinder

[![GitHub](https://img.shields.io/badge/GitHub-POUKONE%2FDataFinder-181717?logo=github)](https://github.com/POUKONE/DataFinder)
[![CI](https://github.com/POUKONE/DataFinder/actions/workflows/ci.yml/badge.svg)](https://github.com/POUKONE/DataFinder/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Application Next.js autonome pour rechercher, filtrer, comparer et enregistrer des sources de données.

Read this in [English](README.en.md).

## Prérequis

- Node.js 22 ou Docker
- npm 10 ou version ultérieure

## Développement local

```bash
npm ci
npm run dev
```

Ouvrir ensuite `http://localhost:3000`.

## Exécution en production avec Node.js

```bash
npm ci
npm run build
DATAFINDER_PUBLIC_URL=https://data.example.com DATAFINDER_API_KEY=une-cle-longue-et-aleatoire npm start
```

## Hébergement avec Docker

Créer un fichier `.env` (voir `.env.example`) contenant au minimum `DATAFINDER_API_KEY`, puis :

```bash
docker compose up -d --build
```

L'application écoute sur le port `3000`. Modifier `DATAFINDER_PUBLIC_URL` dans `compose.yaml` pour utiliser votre domaine public.

## Hébergement sur Vercel

Comme les données sont persistées sur Supabase et non plus sur disque local, l'application peut être déployée telle quelle sur Vercel :

1. Importer le dépôt GitHub dans Vercel
2. Renseigner dans les variables d'environnement du projet Vercel : `DATAFINDER_PUBLIC_URL`, `DATAFINDER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (et `BRAVE_SEARCH_API_KEY` si la recherche web est utilisée)
3. Déployer — Vercel détecte Next.js automatiquement, aucune configuration supplémentaire n'est nécessaire

Le rate limiting de `GET /api/web-search` reste en mémoire par instance : sur Vercel, plusieurs instances serverless peuvent tourner en parallèle, donc cette limite n'est plus garantie de façon stricte à l'échelle globale.

## Authentification API

Les endpoints de lecture (`GET /api/datasets`, `GET /api/datasets/:id`) restent publics. Les endpoints d'écriture (`POST /api/datasets`, `PUT /api/datasets/:id`, `DELETE /api/datasets/:id`) exigent une clé API définie via la variable d'environnement `DATAFINDER_API_KEY`, envoyée dans l'en-tête `Authorization` :

```bash
curl -X DELETE https://data.example.com/api/datasets/mon-dataset \
  -H "Authorization: Bearer $DATAFINDER_API_KEY"
```

Sans `DATAFINDER_API_KEY` configurée côté serveur, ces routes répondent `503`. Une clé absente ou invalide répond `401`.

## Recherche web

En plus du catalogue DataFinder, la barre de recherche interroge aussi le web via l'API [Brave Search](https://brave.com/search/api/). Cette fonctionnalité est optionnelle : sans clé configurée, seuls les résultats du catalogue s'affichent.

1. Créer un compte sur [api-dashboard.search.brave.com/register](https://api-dashboard.search.brave.com/register) (une carte bancaire est demandée pour vérification anti-fraude, non débitée dans la limite du crédit gratuit), puis choisir le plan « Search » ($5 de crédit gratuit par mois, environ 1 000 requêtes).
2. Ajouter la clé obtenue dans `.env` :

```
BRAVE_SEARCH_API_KEY=votre_cle
```

La route `GET /api/web-search?q=...` est publique (lecture seule, comme `GET /api/datasets`) et ne nécessite pas `DATAFINDER_API_KEY`. Sans `BRAVE_SEARCH_API_KEY`, elle répond `503`.

Comme cette route déclenche un appel payant à l'API Brave, elle est protégée par un rate limiting en mémoire (par IP, remis à zéro si le serveur redémarre) : 10 requêtes par minute par défaut, ajustable via `WEB_SEARCH_RATE_LIMIT` (nombre de requêtes) et `WEB_SEARCH_RATE_WINDOW_MS` (durée de la fenêtre en millisecondes). Au-delà, la route répond `429` avec un en-tête `Retry-After`.

## Base de données

Les datasets sont persistés dans [Supabase](https://supabase.com) (Postgres managé), via le client `@supabase/supabase-js`. Deux variables sont requises :

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=votre_cle_service_role
```

Utilisez la clé **service_role** (`Project Settings > Database > Connect > Server`), jamais la clé publique/anon : elle donne un accès complet à la base et ne doit être connue que du serveur. Cette base héberge le catalogue de façon durable, ce qui permet un déploiement sur des plateformes serverless (Vercel, etc.) au système de fichiers éphémère, en plus de Docker/VPS classiques.

Le schéma (table `datasets`, table `meta` pour l'amorçage initial, fonction `get_catalog_stats`) doit être créé une fois dans l'éditeur SQL de votre projet Supabase — voir les commentaires en tête de `lib/db.ts` pour le détail des requêtes.

Avec Docker, `SUPABASE_URL` et `SUPABASE_SECRET_KEY` doivent être fournies à la fois comme arguments de build (`compose.yaml` les passe automatiquement) et comme variables d'environnement à l'exécution, car `next build` interroge déjà la base pendant la génération des pages.

## Reverse proxy Nginx

```nginx
server {
    listen 80;
    server_name data.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Activer ensuite HTTPS avec votre gestionnaire de certificats habituel, par exemple Certbot ou Caddy.

## Vérifications

```bash
npm test
npm run lint
```

`npm test` lance le build puis exécute la suite `node:test` (via `tsx`, avec `--test-concurrency=1`) : le smoke test de rendu ainsi que les tests unitaires du CRUD, de la pagination, de l'authentification, du rate limiting et de la recherche web. Les tests liés aux datasets vident entièrement la table à chaque test (`resetDatasets`) : ils **ne doivent jamais tourner contre le schéma `public`** (celui de production), sous peine de perdre tout le catalogue.

Pour cette raison, les tests ciblent un schéma Postgres séparé, `test`, dans le même projet Supabase (évite de consommer un second projet gratuit). À créer une seule fois via l'éditeur SQL Supabase — voir les commentaires en tête de `lib/db.ts` pour le schéma exact (tables `datasets`/`meta` + fonction `get_catalog_stats`, préfixées `test.`), et penser à ajouter `test` aux "Exposed schemas" dans `Project Settings > Data API`. Créez ensuite un fichier `.env.test` (non versionné) :

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=votre_cle_service_role
SUPABASE_SCHEMA=test
```

`npm test` charge `.env.test` (pas `.env`) pour la phase de test — seule la phase de build initiale touche encore le schéma `public`, de façon inoffensive (vérification de connexion + amorçage idempotent). L'exécution des tests est forcée en séquentiel (`--test-concurrency=1`) pour qu'aucun fichier de test ne marche sur les données d'un autre pendant qu'il vide la table.

Ces vérifications tournent aussi automatiquement sur GitHub Actions à chaque push et pull request (voir `.github/workflows/ci.yml`) : pensez à renseigner `SUPABASE_URL` et `SUPABASE_SECRET_KEY` (ceux de production, le workflow force `SUPABASE_SCHEMA=test`) dans les secrets du dépôt GitHub.

La route `/api/health` vérifie que la base Supabase répond réellement et retourne `200` (`status: "ok"`) ou `503` (`status: "error"`) en conséquence ; elle peut être utilisée par Docker, votre orchestrateur ou votre hébergeur.

## Licence

[MIT](LICENSE) © 2026 POUKONE

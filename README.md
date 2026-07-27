# DataFinder

[![GitHub](https://img.shields.io/badge/GitHub-POUKONE%2FDataFinder-181717?logo=github)](https://github.com/POUKONE/DataFinder)

Application Next.js autonome pour rechercher, filtrer, comparer et enregistrer des sources de données.

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

## Base de données

Les datasets sont persistés dans une base SQLite via le module natif `node:sqlite` (aucune dépendance externe). Par défaut, le fichier est créé dans `data/datafinder.db` (chemin relatif au répertoire de travail), configurable via la variable d'environnement `DATAFINDER_DB_PATH`.

Avec Docker, ce chemin (`/app/data`) est monté sur un volume nommé (`datafinder-data` dans `compose.yaml`) afin que les données survivent aux redémarrages et reconstructions du conteneur.

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

`npm test` lance le build puis exécute la suite `node:test` (via `tsx`) : le smoke test de rendu ainsi que les tests unitaires du CRUD et de la pagination (`tests/datasets-crud.test.ts`, `tests/datasets-pagination.test.ts`), exécutés contre une base SQLite en mémoire (`DATAFINDER_DB_PATH=:memory:`).

La route `/api/health` retourne un état JSON et peut être utilisée par Docker, votre orchestrateur ou votre hébergeur.

# DataFinder

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
DATAFINDER_PUBLIC_URL=https://data.example.com npm start
```

## Hébergement avec Docker

```bash
docker compose up -d --build
```

L'application écoute sur le port `3000`. Modifier `DATAFINDER_PUBLIC_URL` dans `compose.yaml` pour utiliser votre domaine public.

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

La route `/api/health` retourne un état JSON et peut être utilisée par Docker, votre orchestrateur ou votre hébergeur.

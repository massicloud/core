---
title: Clés API
description: Comprendre les clés anon et service de MassiCloud.
---

Chaque projet possède deux clés API, partagées entre toutes les bases du projet — Postgres comme [MySQL](/fr/concepts/mysql). Elles déterminent le rôle utilisé pour les requêtes et contrôlent l'accès à vos données. Le reste de cette page décrit le modèle de rôle Postgres/RLS ; les bases MySQL utilisent un modèle à deux rôles plus simple, sans équivalent RLS — voir [Authentification : instances MySQL](/fr/concepts/authentication).

## Clé anon (`mc_anon_…`)

Peut être incluse dans le code navigateur et mobile. Elle accorde uniquement le rôle Postgres `anon`, ce qui signifie que les requêtes sont soumises à vos politiques RLS.

Utilisez des variables d'environnement pour éviter de la coder en dur :

```js
// Vite
const massi = createClient({ key: import.meta.env.VITE_MASSI_KEY, ... })

// Next.js
const massi = createClient({ key: process.env.NEXT_PUBLIC_MASSI_KEY, ... })
```

## Clé service (`mc_service_…`)

Ne l'exposez jamais dans le code client. Elle accorde le rôle Postgres `service_role`, qui contourne toutes les politiques RLS. Utilisez-la pour :

- Les routes API côté serveur
- Les jobs et workers en arrière-plan
- Les scripts d'administration et migrations

## Rotation des clés

Allez dans **Projet → Clés API → Pivoter** dans le portail. Les anciennes clés cessent de fonctionner immédiatement. Mettez à jour vos déploiements avant de pivoter.

## En cas de fuite

Si votre clé anon fuit, pivotez-la. Les dégâts sont limités par vos politiques RLS.

Si votre clé service fuit, pivotez-la immédiatement — elle contourne toutes les RLS. Traitez-la comme un mot de passe root de base de données.

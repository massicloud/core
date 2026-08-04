---
title: Authentification
description: Comment fonctionne le modèle d'auth à trois niveaux de MassiCloud.
---

MassiCloud a trois rôles avec lesquels vous travaillerez : **anon**, **authenticated** et **service_role**. Les comprendre est l'étape la plus importante pour maîtriser la plateforme.

## Les trois rôles

| Rôle            | Qui              | Ce qu'il peut faire                                                              |
| --------------- | ---------------- | -------------------------------------------------------------------------------- |
| `anon`          | N'importe qui    | Ce que vos politiques RLS autorisent pour `anon`                                 |
| `authenticated` | Un utilisateur connecté | Ce que vos politiques RLS autorisent pour `authenticated`, limité à cet utilisateur via `auth.uid()` |
| `service_role`  | Votre serveur    | Tout — contourne toutes les RLS                                                  |

Le rôle d'une requête est déterminé par la clé + le token envoyés.

## Comment une requête obtient un rôle

Chaque requête API inclut un en-tête `X-MassiCloud-Key` — soit votre **clé anon** soit votre **clé service** :

```
X-MassiCloud-Key: mc_anon_xxxxx
```

Cela seul donne à la requête le rôle `anon`.

Pour obtenir le rôle `authenticated`, la requête inclut AUSSI un en-tête `Authorization: Bearer <jwt>` avec un JWT obtenu depuis `signIn` :

```
X-MassiCloud-Key: mc_anon_xxxxx
Authorization:   Bearer eyJhbGc...
```

Postgres exécute alors la requête avec `role = 'authenticated'` et `auth.uid()` retourne l'ID de l'utilisateur, permettant aux politiques RLS de filtrer par utilisateur.

Pour obtenir `service_role`, envoyez directement la clé service :

```
X-MassiCloud-Key: mc_service_xxxxx
```

Cela contourne toutes les RLS — utilisez-le uniquement depuis du code serveur de confiance.

## Les clés

- **Clé anon** (`mc_anon_...`) — Publique. Embarquée dans les navigateurs et apps mobiles. Ne peut faire que ce que les politiques RLS autorisent pour le rôle `anon`.
- **Clé service** (`mc_service_...`) — Secrète. NE JAMAIS embarquer dans le code client. Contourne RLS.

Si vous faites fuiter une clé service, faites-la pivoter immédiatement depuis la page Clés API du portail.

## Instances MySQL : pas d'auth par ligne

Tout ce qui précède décrit Postgres, où Row Level Security permet à `anon` et `authenticated` de voir des lignes différentes de la *même* table. MySQL n'a pas d'équivalent RLS, donc les [bases de données MySQL](/fr/concepts/mysql) n'ont que deux rôles : `massi_anon` (lecture seule, toutes les lignes) et `massi_service` (accès complet). Il n'y a pas de rôle `authenticated` ni de filtrage par ligne par utilisateur — si vous en avez besoin, filtrez dans le code de votre application, ou utilisez Postgres.

## Authentification des utilisateurs finaux

Les utilisateurs finaux s'inscrivent et se connectent via les endpoints auth. Le SDK les enveloppe :

```js
await massi.auth.signUp({ email, password })
await massi.auth.signIn({ email, password })
await massi.auth.signOut()
```

Cela stocke l'utilisateur dans la table `auth.users` de votre Postgres tenant et retourne un JWT signé avec le secret de votre projet. Le SDK gère ce token — auto-refresh, stockage, etc.

## Ce qui est stocké où

| Quoi                                          | Où                                               |
| --------------------------------------------- | ------------------------------------------------- |
| Votre login de plateforme (vous, le dev)       | Plan de contrôle central de MassiCloud           |
| Clés API du projet (anon, service)            | Plan de contrôle de MassiCloud                   |
| Comptes utilisateurs finaux (vos clients)     | VOTRE Postgres tenant dans `auth.users`          |
| JWTs utilisateurs finaux                      | Côté client, géré par le SDK                     |

Les utilisateurs finaux sont scoped au projet — ils vivent dans votre base tenant, pas dans un système central partagé.

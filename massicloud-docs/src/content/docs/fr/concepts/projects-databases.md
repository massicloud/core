---
title: Projets & Bases de données
description: Comment MassiCloud organise vos ressources.
---

## Projets

Un projet est l'unité organisationnelle de haut niveau dans MassiCloud. Pensez-y comme une application. Un projet possède :

- Des bases de données (Postgres) et des instances Redis
- Des buckets de stockage
- Des clés API (anon et service)
- Des comptes utilisateurs finaux

Vous créez généralement un projet par application. Si vous avez besoin d'environnements de staging et production, créez deux projets — ou utilisez deux bases de données dans un seul projet.

## Clés API

À la création d'un projet, deux clés sont générées :

| Clé | Préfixe | Utilisation |
| --- | ------- | ----------- |
| Clé anon | `mc_anon_` | Navigateur / apps mobiles. Soumise à RLS. |
| Clé service | `mc_service_` | Côté serveur uniquement. Contourne RLS. |

La clé service est affichée **une seule fois** à la création. Stockez-la immédiatement dans votre gestionnaire de secrets.

## Bases de données

Chaque base de données dans un projet est une instance Postgres, créée à la création du projet. Vous pouvez avoir plusieurs bases par projet.

### Le schéma `auth`

Le schéma `auth` et tout ce qui en découle (RLS, `auth.uid()`, etc.) s'applique à vos bases Postgres.

Quand vous activez le schéma auth, MassiCloud crée :

- `auth.users` — les utilisateurs finaux de votre application
- `auth.sessions` — les sessions actives
- Fonctions utilitaires : `auth.uid()`, `auth.role()`, `auth.email()`

Ces fonctions sont utilisées par les politiques RLS pour restreindre l'accès par utilisateur.

### Le schéma `public`

Vos tables applicatives vivent ici par défaut. Les tables créées via le portail ou les migrations atterrissent dans `public.*`.

### Redis

Les bases Redis sont disponibles pour le cache, pub/sub, et la limitation de débit. Connectez-vous via les bibliothèques clientes Redis standard en utilisant la chaîne de connexion du portail.

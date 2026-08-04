---
title: MySQL
description: MySQL 8.4 comme option de base de données à part entière, avec CRUD REST et compatibilité SDK.
---

En plus de Postgres, MassiCloud peut provisionner une instance **MySQL 8.4 LTS** dédiée par base de données. Elle bénéficie de la même ergonomie REST-sur-HTTP que Postgres — même forme d'URL, mêmes appels SDK — grâce à un service REST léger développé par MassiCloud plutôt que PostgREST.

## Quand choisir MySQL plutôt que Postgres

Postgres reste l'option par défaut, la plus capable — Row Level Security, `json`/`jsonb`, extensions, requêtes de relations imbriquées (`select=*,posts(*)`), SQL complet. Optez pour MySQL quand :

- Vous portez une application ou un schéma ORM existant déjà écrit pour MySQL.
- L'expérience opérationnelle de votre équipe est spécifiquement sur MySQL.
- Vous n'avez pas besoin d'autorisation par ligne — les bases MySQL n'ont que deux niveaux d'accès (voir [Authentification](/fr/concepts/authentication)).

Si vous démarrez de zéro sans raison particulière de choisir MySQL, utilisez Postgres.

## Ce qui est supporté

- **CRUD REST** — `GET`/`POST`/`PATCH`/`DELETE` sur `/rest/{table}`, forme d'URL identique à Postgres.
- **Filtrage de base** — un sous-ensemble de la syntaxe de filtres PostgREST : `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `in`, `is null` / `is not null`, plus `select`, `order`, `limit`, `offset`.
- **La console SQL** du portail, avec des requêtes de démarrage rapide spécifiques à MySQL (`SHOW TABLES`, `EXPLAIN`, `SHOW ENGINE INNODB STATUS`, etc.).
- **Préréglages de schéma** à la création (base vide, ou table `users` basique).

## Ce qui n'est pas supporté

- **Row Level Security** — MySQL n'a pas d'équivalent RLS. Chaque requête est soit `massi_anon` (lecture seule), soit `massi_service` (accès complet) ; pas de filtrage par ligne par utilisateur. Filtrez dans le code de votre application si nécessaire.
- **Relations imbriquées** — les jointures façon PostgREST `select=*,posts(*)` ne sont pas implémentées. Utilisez la console SQL pour tout ce qui dépasse le filtrage sur une seule table.
- **RPC personnalisées / fonctions stockées** — pas encore d'équivalent aux appels `rpc()` de Postgres.
- **Temps réel** — pas d'équivalent au temps réel basé sur `LISTEN`/`NOTIFY` de Postgres ; MySQL n'a pas de primitive comparable.
- **Sauvegardes** — pas encore câblées pour les instances MySQL (les instances Postgres sont sauvegardées automatiquement).

Si votre code tombe sur l'une de ces limites, le service mysql-rest retourne une erreur `400` expliquant que le filtre n'est pas supporté — il ne retournera jamais silencieusement des données incorrectes.

## Exemple

Créer et utiliser une base MySQL ressemble en tout point à Postgres du point de vue du SDK :

```ts
const massi = createClient({
  url: 'https://api.massicloud.work',
  key: anonKey,
  stage: 'production',
  db: 'mysql_main',
})

const { data, error } = await massi.from('users').select().eq('email', 'someone@example.dz')
```

Le SDK ne sait pas — et n'a pas besoin de savoir — si `mysql_main` est Postgres ou MySQL : la plateforme route la requête vers le bon service REST côté serveur, selon la façon dont la base a été provisionnée.

## Modèle d'authentification

Deux rôles fixes, configurés automatiquement à la création de l'instance :

| Rôle             | Accès                              |
| ---------------- | ----------------------------------- |
| `massi_anon`     | `SELECT` seul, toutes les lignes    |
| `massi_service`  | Lecture/écriture complète, toutes les lignes |

Le rôle attribué à une requête dépend de la clé envoyée (anon ou service) — comme pour Postgres, mais sans le niveau `authenticated` ni le filtrage de lignes basé sur RLS.

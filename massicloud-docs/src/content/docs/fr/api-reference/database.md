---
title: API Base de données (REST)
description: Endpoints HTTP pour interroger votre base de données Postgres.
---

import { Aside } from '@astrojs/starlight/components'

<Aside type="caution">
La documentation française est en cours de mise à jour avec les derniers changements de MassiCloud. La version anglaise est à jour : [voir en anglais](/api-reference/database).
</Aside>

L'API REST pour interroger les tables suit les conventions [PostgREST](https://postgrest.org).

## Chemin de base

```
/{stage}/db/{database-name}/rest/{table-name}
```

## GET — sélectionner des lignes

```
GET /production/db/main/rest/posts
```

Paramètres de requête :

| Paramètre  | Exemple                          | Effet                                   |
| ---------- | -------------------------------- | --------------------------------------- |
| `select`   | `id,title,created_at`            | Colonnes à retourner (défaut : `*`)     |
| `order`    | `created_at.desc`                | Colonne de tri et direction             |
| `limit`    | `20`                             | Nombre maximum de lignes                |
| `offset`   | `40`                             | Ignorer des lignes (pour la pagination) |
| `{col}`    | `published=eq.true`              | Filtre : `col=op.value`                 |

Opérateurs de filtre : `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`, `cs`, `cd`.

## POST — insérer des lignes

```
POST /production/db/main/rest/posts
Content-Type: application/json
Prefer: return=representation

{ "title": "Bonjour", "body": "..." }
```

Passez un tableau pour les insertions en masse.

## PATCH — mettre à jour des lignes

```
PATCH /production/db/main/rest/posts?id=eq.{uuid}
Content-Type: application/json

{ "title": "Mis à jour" }
```

Incluez toujours un filtre pour éviter de mettre à jour toutes les lignes.

## DELETE — supprimer des lignes

```
DELETE /production/db/main/rest/posts?id=eq.{uuid}
```

Incluez toujours un filtre.

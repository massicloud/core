---
title: Aperçu de l'API
description: L'API HTTP de MassiCloud — URLs de base, authentification et conventions.
---

L'API MassiCloud est une API HTTP RESTful. Le SDK JavaScript est une fine couche autour d'elle ; vous pouvez l'appeler directement depuis n'importe quel langage.

## URL de base

```
https://api.massicloud.dz/v1/{project-slug}
```

Votre slug de projet est affiché dans le portail sous Projet → Paramètres.

## Authentification

Chaque requête nécessite l'en-tête `X-MassiCloud-Key` :

```
X-MassiCloud-Key: mc_anon_your_key
```

Pour les requêtes authentifiées (pour invoquer RLS en tant qu'utilisateur spécifique), incluez également :

```
Authorization: Bearer eyJhbGc...
```

## Type de contenu

Tous les corps de requête et de réponse sont en JSON :

```
Content-Type: application/json
Accept: application/json
```

## Format de réponse

Tous les endpoints retournent :

```ts
{
  data:  T | null,
  error: { message: string; status: number } | null,
}
```

## Sections

- [Endpoints d'authentification](/fr/api-reference/authentication)
- [Endpoints Base de données (REST)](/fr/api-reference/database)
- [Codes d'erreur](/fr/api-reference/errors)

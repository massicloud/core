---
title: API Authentification
description: Endpoints HTTP pour l'authentification des utilisateurs.
---

Tous les endpoints d'authentification sont sous `/auth` relatif à l'URL de base de votre projet.

## POST /auth/signup

Inscrire un nouvel utilisateur.

**Corps de la requête :**
```json
{ "email": "user@example.dz", "password": "secret123" }
```

**Réponse (201) :**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.dz", "created_at": "..." },
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_at": 1718284800,
    "token_type": "Bearer"
  },
  "error": null
}
```

## POST /auth/login

Connecter un utilisateur existant.

**Corps de la requête :**
```json
{ "email": "user@example.dz", "password": "secret123" }
```

**Réponse (200) :** Même structure que signup.

## POST /auth/logout

Invalider le refresh token actuel.

**En-têtes :** Nécessite `Authorization: Bearer <access_token>`

**Réponse (200) :**
```json
{ "data": null, "error": null }
```

## POST /auth/refresh

Échanger un refresh token contre un nouveau access token.

**Corps de la requête :**
```json
{ "refresh_token": "eyJ..." }
```

**Réponse (200) :** Même structure que login.

## GET /auth/user

Obtenir l'utilisateur actuellement authentifié.

**En-têtes :** Nécessite `Authorization: Bearer <access_token>`

**Réponse (200) :**
```json
{
  "data": { "user": { "id": "...", "email": "...", "created_at": "..." } },
  "error": null
}
```

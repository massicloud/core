---
title: Erreurs
description: Codes de statut HTTP et format des réponses d'erreur.
---

Toutes les réponses d'erreur suivent le même format :

```json
{
  "data": null,
  "error": {
    "message": "description lisible par un humain",
    "status":  400
  }
}
```

## Codes de statut courants

| Statut | Signification                                                                            |
| ------ | ---------------------------------------------------------------------------------------- |
| 400    | Requête incorrecte — JSON malformé, champ requis manquant                               |
| 401    | Non autorisé — clé ou JWT manquant ou invalide                                           |
| 403    | Interdit — identifiants valides mais RLS a refusé l'opération                            |
| 404    | Introuvable — la table ou la ressource n'existe pas                                      |
| 409    | Conflit — violation de contrainte unique (ex. email en double lors de l'inscription)     |
| 422    | Non traitable — erreur de validation (ex. mot de passe trop court)                       |
| 500    | Erreur interne du serveur — quelque chose s'est mal passé de notre côté                  |

## Erreurs RLS

Lorsqu'une opération est bloquée par RLS, vous recevrez un `403` avec :

```json
{ "error": { "message": "row-level security policy violation", "status": 403 } }
```

Vérifiez que :

1. La table a une politique appropriée pour le rôle demandeur
2. Vous envoyez l'en-tête `Authorization: Bearer` pour les requêtes authentifiées
3. Le `auth.uid()` dans la politique correspond à l'ID réel de l'utilisateur

## Conseils de débogage

- Un `403` sur `.select()` signifie généralement qu'il n'existe pas de politique SELECT pour `anon`.
- Un `403` sur `.insert()` signifie généralement que la clause `WITH CHECK` échoue.
- Un `data: []` vide (pas une erreur) signifie que la requête a été exécutée mais RLS a filtré toutes les lignes.

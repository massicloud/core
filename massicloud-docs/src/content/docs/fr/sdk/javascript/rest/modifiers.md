---
title: Modificateurs
description: Façonnez le jeu de résultats avec order, limit, offset, single, et count.
---

Les modificateurs façonnent le résultat : tri, pagination et format de réponse.

## Référence

| Méthode                                       | Effet                                                    |
| --------------------------------------------- | -------------------------------------------------------- |
| `.order(col, { ascending })`                  | Trier les résultats                                      |
| `.limit(n)`                                   | Retourner au maximum n lignes                            |
| `.range(from, to)`                            | Découper les lignes par index (base 0, inclusif)         |
| `.single()`                                   | Attendre exactement une ligne — erreur si 0 ou 2+        |
| `.maybeSingle()`                              | Retourner une ligne ou null — erreur seulement si 2+     |
| `.count('exact' \| 'planned' \| 'estimated')` | Inclure le nombre de lignes dans la réponse              |

## Exemples

```ts
// Pagination — page 2, 20 éléments par page
await massi
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .range(20, 39)

// Attendre exactement une ligne
const { data: post, error } = await massi
  .from('posts')
  .select('*')
  .eq('id', postId)
  .single()
// data est Post (pas Post[]), error est défini si introuvable

// Compter sans récupérer les lignes
const { count } = await massi
  .from('posts')
  .select('*', { count: 'exact', head: true })
```

## Notes

- `.single()` définit `Prefer: return=representation` et valide le nombre. Si vous obtenez une erreur comme `"JSON object requested, multiple (or no) rows returned"`, votre filtre n'est pas assez spécifique.
- `.range()` envoie `Range: from-to` et retourne une réponse `206 Partial Content`. Utilisez-le pour toutes les UIs paginées.

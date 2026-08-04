---
title: Row Level Security
description: Comment MassiCloud utilise RLS Postgres pour contrôler l'accès aux données.
---

**Row Level Security** (RLS) est une fonctionnalité Postgres qui filtre les lignes selon l'utilisateur actuel. Quand vous interrogez une table avec RLS, c'est la base de données elle-même qui décide ce que vous pouvez voir — pas le code de votre application.

MassiCloud active RLS par défaut sur chaque table créée via la plateforme. C'est intentionnel : il est plus sûr de se désabonner de la sécurité que de s'y abonner.

## Comment ça fonctionne

Quand une requête atteint l'API REST avec un JWT, MassiCloud :

1. Valide le JWT
2. Extrait les claims : `sub` (id utilisateur), `role`, etc.
3. Ouvre une connexion Postgres
4. Exécute `SET LOCAL request.jwt.claims TO '<claims>'`
5. Exécute `SET LOCAL role TO 'authenticated'` (ou `'anon'` / `'service_role'`)
6. Exécute votre requête

Les politiques RLS sur la table peuvent maintenant lire ces valeurs via des fonctions utilitaires :

- `auth.uid()` — l'UUID de l'utilisateur
- `auth.role()` — `'authenticated'` ou `'anon'`
- `auth.email()` — l'email de l'utilisateur

## Politiques par défaut

Quand vous créez une table via le portail, MassiCloud ajoute deux politiques par défaut :

1. **Les utilisateurs voient leurs propres lignes** — si la table a une colonne `user_id`, seul l'utilisateur dont l'ID correspond peut lire ou modifier.
2. **Accès complet pour service_role** — les requêtes `service_role` contournent RLS entièrement.

Si votre table n'a pas de colonne `user_id`, la première politique est remplacée par **"Lecture authentifiée de tout"** — tout utilisateur connecté peut lire toutes les lignes, mais personne sauf service_role ne peut modifier.

## Écrire vos propres politiques

Modèles courants :

**Les utilisateurs gèrent leurs propres lignes :**

```sql
CREATE POLICY "users manage own" ON todos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid())
```

**Tout le monde peut lire ; seuls les authentifiés peuvent créer :**

```sql
CREATE POLICY "public read"  ON posts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "auth insert" ON posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
```

**Seul l'auteur d'une ligne peut la mettre à jour :**

```sql
CREATE POLICY "author updates" ON posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
```

## Cas limites importants

- **Une table avec RLS activé mais sans politiques bloque tout**, sauf `service_role` qui contourne RLS. Si votre requête retourne `[]` à tort, vérifiez que des politiques existent.
- **INSERT** utilise `WITH CHECK`, pas `USING`. Assurez-vous que vos politiques INSERT définissent `WITH CHECK`.
- **UPDATE** utilise les deux : `USING` pour quelles lignes peuvent être ciblées, `WITH CHECK` pour à quoi la nouvelle ligne est autorisée à ressembler.

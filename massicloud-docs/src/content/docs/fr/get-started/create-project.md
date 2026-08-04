---
title: Créer votre premier projet
description: Les projets sont le conteneur de haut niveau pour vos bases de données, votre stockage et vos clés API.
---

import { Steps, Aside } from '@astrojs/starlight/components'

<Aside type="caution">
La documentation française est en cours de mise à jour avec les derniers changements de MassiCloud. La version anglaise est à jour : [voir en anglais](/get-started/create-project).
</Aside>

Un **projet** dans MassiCloud est le conteneur principal de tout ce qui concerne une application : ses bases de données, ses buckets de stockage, ses clés API, ses utilisateurs finaux.

Vous aurez un projet par application construite. Un développeur typique a 2 à 5 projets au total.

## Créer le projet

<Steps>

1. **Depuis votre tableau de bord, cliquez sur "Nouveau projet"**

2. **Donnez-lui un nom**

   Choisissez quelque chose de descriptif — `mon-todo-app`, `blog-algerie`, `shop-backend`. Le slug est auto-généré à partir du nom et utilisé dans les URLs API.

3. **Cliquez sur "Créer"**

   Le portail créera le projet ET vos clés API simultanément. **Sauvegardez les deux clés quand elles s'affichent — la clé complète n'est montrée qu'une seule fois.**

   - **Clé anon** (`mc_anon_...`) — peut être embarquée dans le code navigateur
   - **Clé service** (`mc_service_...`) — secrète, côté serveur uniquement

</Steps>

## Ajouter une base de données

Le projet est créé, mais il n'a pas encore de bases de données. Ajoutons-en une.

<Steps>

1. **Cliquez sur "Bases de données" dans la barre latérale du projet**

2. **Cliquez sur "Nouvelle base de données"**

3. **Choisissez Postgres** (Redis est aussi disponible pour le cache)

4. **Nommez-la `production`**

   Les noms de bases de données sont utilisés dans les URLs API. Utilisez uniquement des lettres minuscules, chiffres, tirets, underscores.

5. **Activez le schéma `auth`** quand demandé

   Cela crée une table `auth.users` où vivront les utilisateurs finaux de votre application. Nous en aurons besoin à l'étape suivante.

6. **Cliquez sur "Créer"**

   Le démarrage du conteneur de base de données prend environ 15 secondes.

</Steps>

Vous avez maintenant un projet, deux clés API et une base de données Postgres en fonctionnement avec le schéma auth activé. Place au premier appel.

[Effectuer votre première requête →](/fr/get-started/first-request)

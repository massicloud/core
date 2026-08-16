---
title: Aperçu de la plateforme
description: Les concepts clés de MassiCloud.
---

MassiCloud s'articule autour d'un petit ensemble d'idées centrales. Les comprendre rend tout le reste évident.

## Projets

Un **projet** est le conteneur de haut niveau. Un projet par application. Il possède :

- Une ou plusieurs **bases de données** (Postgres) et des instances **Redis**
- Des **buckets de stockage** pour les fichiers
- Des **clés API** (anon + service)
- Des **utilisateurs finaux** (les clients de votre application)

[Projets & Bases de données →](/fr/concepts/projects-databases)

## Bases de données

Chaque base de données est une instance Postgres managée avec une API REST auto-générée via PostgREST. Vous interagissez avec elle via le SDK ou directement en HTTP. Vous pouvez aussi vous connecter avec n'importe quel client Postgres pour les migrations, requêtes, etc.

## Authentification

Trois rôles gouvernent chaque requête : `anon`, `authenticated` et `service_role`. Le rôle appliqué dépend de la clé et du JWT envoyés avec la requête.

[Authentification →](/fr/concepts/authentication)

## Row Level Security

L'accès aux données est contrôlé par des politiques RLS Postgres. La base de données elle-même applique qui peut lire, insérer, mettre à jour ou supprimer des lignes.

[Row Level Security →](/fr/concepts/rls)

## Souveraineté

Toutes les données restent en Algérie. Pas de transferts transfrontaliers. Conforme aux lois 18-07 et 25-11 par construction.

[Souveraineté & Conformité →](/fr/concepts/sovereignty)

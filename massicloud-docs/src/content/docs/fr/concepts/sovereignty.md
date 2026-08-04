---
title: Souveraineté & Droit algérien
description: Pourquoi MassiCloud existe et comment il se conforme aux lois 18-07 et 25-11.
---

MassiCloud existe parce que les entreprises algériennes ne peuvent plus utiliser en toute sécurité des clouds étrangers pour les données personnelles. Cette page explique le contexte juridique et comment MassiCloud est construit pour le satisfaire.

## Les lois concernées

- **Loi 18-07 (juin 2018)** — La loi fondatrice de protection des données en Algérie. Crée l'ANPDP (Autorité Nationale de Protection des Données Personnelles), définit la donnée personnelle, établit les exigences de consentement, la notification des violations (5 jours) et les droits des personnes concernées.

- **Loi 25-11 (juillet 2025)** — Amendement majeur. Rend obligatoire la déclaration ANPDP pour toute entreprise traitant des données personnelles. Pénalités jusqu'à 1 000 000 DZD et responsabilité pénale pour non-conformité. Restreint fortement les transferts transfrontaliers de données.

Ensemble, ces lois signifient : **stocker les données personnelles d'Algériens sur AWS, GCP, Azure, Supabase ou tout autre service étranger est désormais un risque juridique pour les entreprises algériennes.**

## Comment MassiCloud satisfait ces lois

| Exigence                              | Comment MassiCloud la gère                                     |
| ------------------------------------- | -------------------------------------------------------------- |
| Résidence des données en Algérie      | Toutes les bases de données physiquement en Algérie            |
| Support de déclaration ANPDP          | Schéma de conformité intégré (`compliance.data_registry`, etc.) |
| Suivi du consentement                 | Table `compliance.consents` intégrée                           |
| Notification de violation (Art. 38)   | Table `compliance.breaches` intégrée                           |
| Piste d'audit                         | Schéma `audit` optionnel activable par base                    |
| Prévention des transferts             | Architecturalement impossible — les données ne quittent pas l'Algérie |
| Chiffrement au repos et en transit    | TLS 1.3 entre client et API ; SSL entre API et DB             |

## Ce que cela signifie pour vous en tant que développeur

Vous écrivez votre application. Vous utilisez MassiCloud. Vos données ne vont nulle part où elles ne devraient pas aller, votre app est plus rapide (latence réduite vers les utilisateurs algériens), et vous avez une histoire de conformité légale intégrée à votre stack.

Vous devez encore faire **votre** part de conformité :

- Déclarer votre traitement à l'ANPDP si requis pour votre secteur
- Avoir une Politique de Confidentialité
- Honorer les demandes des personnes concernées (nous fournissons les outils)

Ce que vous n'avez pas à faire : consulter un avocat pour votre choix d'hébergement. La couche cloud est souveraine par construction.

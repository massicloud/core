---
title: Sovereignty & Algerian Law
description: Why MassiCloud exists, and how it complies with Law 18-07 and 25-11.
---

MassiCloud exists because Algerian businesses can no longer safely use foreign clouds for personal data. This page explains the legal context and how MassiCloud is built to satisfy it.

## The relevant laws

- **Law 18-07 (June 2018)** — Algeria's foundational data protection law. Creates the ANPDP (Autorité Nationale de Protection des Données Personnelles), defines personal data, establishes consent requirements, breach notification (5 days), and the rights of data subjects.

- **Law 25-11 (July 2025)** — Major amendment. Mandates ANPDP declaration for any business handling personal data. Penalties up to 1,000,000 DZD and criminal liability for non-compliance. Strongly restricts cross-border data transfers.

Together these mean: **storing the personal data of Algerians on AWS, GCP, Azure, Supabase, or any other foreign service is now a legal risk for Algerian businesses.**

## How MassiCloud satisfies these laws

| Requirement                           | How MassiCloud handles it                                      |
| ------------------------------------- | -------------------------------------------------------------- |
| Data residency in Algeria             | All databases physically located in Algerian datacenters       |
| ANPDP declaration support             | Built-in compliance schema (`compliance.data_registry`, etc.)  |
| Consent tracking                      | Built-in `compliance.consents` table                           |
| Breach notification (Article 38)      | Built-in `compliance.breaches` table for record-keeping        |
| Audit trail                           | Optional `audit` schema enabled per database                   |
| Cross-border transfer prevention      | Architecturally impossible — data cannot leave Algeria         |
| Encryption at rest and in transit     | TLS 1.3 between client and API; SSL between API and DB         |

## What this means for you as a developer

You write your app. You use MassiCloud. Your data goes nowhere it shouldn't, your app gets faster (lower latency to Algerian users), and you get a legal compliance story built into your stack.

You still need to do **your** part of compliance:

- Declare your processing to ANPDP if required for your sector
- Have a Privacy Policy
- Honor data subject requests (we provide the tools)

What you don't have to do: lawyer-up over your hosting choice. The cloud layer is sovereign by construction.

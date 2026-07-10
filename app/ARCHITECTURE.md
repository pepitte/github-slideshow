# Architecture — Plateforme de RDV devis paysagiste

## Vue d'ensemble

Application **full-stack Next.js 14 (App Router)** : le front public, l'espace admin et
l'API vivent dans le même déploiement (Vercel ou tout hébergeur Node).

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js (App Router)                    │
│                                                             │
│  Front public (mobile-first)      Espace admin (protégé)    │
│  ├─ / ............ landing +      ├─ /admin ....... dashboard│
│  │                 tunnel 3 étapes├─ /admin/login            │
│  ├─ /confirmation/[id]            └─ /admin/parametres       │
│  └─ /annuler/[token]                                        │
│                                                             │
│  API Routes                                                 │
│  ├─ /api/availability      créneaux libres (BDD + Google)   │
│  ├─ /api/zone/check        filtre CP / rayon km             │
│  ├─ /api/bookings          création RDV → Google + SMS + ✉️  │
│  ├─ /api/bookings/cancel   annulation → libère Google       │
│  ├─ /api/leads             prospects hors zone              │
│  ├─ /api/admin/*           login, RDV, réglages             │
│  ├─ /api/google/*          OAuth 2.0 (connect + callback)   │
│  └─ /api/cron/reminders    rappels SMS 24 h / 1 h           │
└──────────┬──────────────┬───────────────┬───────────────────┘
           │              │               │
     Prisma ORM      Google APIs      Twilio (SMS)
     SQLite (dev)    Calendar         Resend (email + .ics)
     PostgreSQL      freeBusy/events  Meta Pixel (front)
     (prod)          Places/Geocoding
```

## Modèle de données (Prisma)

| Modèle     | Rôle |
|------------|------|
| `Settings` | Ligne unique : entreprise, branding, horaires, congés, zone (CP ou rayon), durée/buffer, modèles SMS/email, tokens Google OAuth |
| `Booking`  | RDV : coordonnées prospect, adresse chantier, type projet, description, créneau, statut (`a_faire / devis_envoye / gagne / perdu / annule`), `cancelToken`, `googleEventId`, drapeaux de rappel |
| `Photo`    | 1–3 photos par RDV (base64 en MVP → S3/Cloudinary en prod) |
| `Lead`     | Prospects hors zone (formulaire de contact) |

## Logique anti double-booking

1. `/api/availability` fusionne : horaires d'ouverture + congés + RDV actifs en BDD
   + périodes occupées **Google freeBusy** (interrogé en direct → temps réel).
2. Chaque créneau bloque `[début − buffer, fin + buffer]` (temps de trajet paramétrable).
3. À la soumission, le créneau est **revérifié** ; s'il vient d'être pris → 409 et le
   client choisit un autre créneau.
4. Le RDV est poussé dans Google Agenda (`events.insert`) → il bloque aussi les
   créneaux pour les réservations suivantes. Une annulation supprime l'événement.

## Notifications

| Moment | Canal | Déclencheur |
|--------|-------|-------------|
| Immédiat après réservation | SMS (Twilio) + email avec `.ics` (Resend) | `POST /api/bookings` (automatique, aucune action du gérant) |
| 24 h avant | SMS | Cron `/api/cron/reminders` (Vercel Cron toutes les 10 min, protégé par `CRON_SECRET`) |
| 1 h avant | SMS | idem |

Tous les textes sont personnalisables dans l'admin (variables `{{prenom}}`, `{{date}}`,
`{{heure}}`, `{{adresse}}`, `{{entreprise}}`, `{{telephone}}`, `{{lien_annulation}}`).
Le lien d'annulation `/annuler/[token]` annule le RDV, supprime l'événement Google
(créneau libéré) et propose de reprendre RDV.

## Écrans clés

1. **Landing** (`/`) — logo, promesse « devis réservé en 60 s », photos de
   réalisations, avis clients, CTA unique vers le tunnel.
2. **Tunnel de réservation** (3 étapes, barre de progression) :
   - Étape 1 : type de projet (6 tuiles), description libre, 1–3 photos (compressées côté client).
   - Étape 2 : prénom/nom/tél/email + adresse avec **autocomplétion Google Places** → contrôle de zone. Hors zone → écran « nous ne couvrons pas encore votre secteur » + formulaire de contact.
   - Étape 3 : calendrier type Calendly (jours horizontaux + grilles d'heures), uniquement les créneaux libres.
3. **Confirmation** (`/confirmation/[id]`) — récap complet + rappel des SMS/email envoyés.
4. **Annulation** (`/annuler/[token]`) — annule et libère le créneau, propose de re-réserver.
5. **Admin login** (`/admin/login`) — email + mot de passe (cookie HMAC signé, middleware).
6. **Dashboard** (`/admin`) — RDV triés par date, fiche dépliable (contact cliquable, description, photos), changement de statut en 1 tap, liste des demandes hors zone.
7. **Paramètres** (`/admin/parametres`) — connexion Google en 1 clic (OAuth), horaires par jour, congés, zone (CP ou rayon km), durée/buffer/préavis, branding, textes SMS/email.

## Sécurité

- Tokens Google stockés côté serveur uniquement, jamais renvoyés à l'admin front.
- Session admin = cookie httpOnly signé HMAC-SHA256 (`AUTH_SECRET`).
- Route cron protégée par `CRON_SECRET`.
- Lien d'annulation par token opaque (cuid) non devinable.

## Tracking

Meta Pixel (`NEXT_PUBLIC_META_PIXEL_ID`) : `PageView` sur toutes les pages,
`Lead` quand le prospect passe le contrôle de zone (ou laisse un contact hors zone),
`Schedule` à la réservation confirmée — l'événement de conversion à optimiser dans Meta Ads.

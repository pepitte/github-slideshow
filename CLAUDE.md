# Projet : Arboris Paysage — SaaS de prise de RDV devis

## Contexte

Ce dépôt était à l'origine un projet Jekyll d'apprentissage GitHub (fichiers à la
racine : `_posts/`, `Gemfile`, etc. — ne pas y toucher). Le vrai projet vit dans
**`app/`** : une plateforme de réservation de rendez-vous de devis pour
**Arboris Paysage**, entreprise de paysagisme (client : Thomas).

Branche de travail : `claude/landscaping-booking-platform-ejx6ap`.

## Le produit

- **Parcours client mobile-first** (trafic issu de pubs Meta) : landing →
  tunnel 3 étapes (projet + photos, coordonnées + adresse Google Places,
  créneaux temps réel type Calendly) → confirmation. Objectif < 60 secondes.
- **Notifications** : SMS Twilio automatique à la réservation, email Resend
  avec .ics, rappels SMS 24 h et 1 h avant (cron `/api/cron/reminders`).
  Lien d'annulation qui libère le créneau.
- **Anti double-booking** : Google Calendar OAuth (freeBusy en direct) + RDV
  en BDD + revérification du créneau à la soumission. Buffer trajet paramétrable.
- **Zone d'intervention** : codes postaux (préfixe accepté) ou rayon km ;
  hors zone → message + formulaire de contact (Lead).
- **Espace admin** (`/admin`) : dashboard RDV avec statuts (à faire / devis
  envoyé / gagné / perdu / annulé), paramètres (horaires, congés, zone, durées,
  textes SMS/email, logo, photos de réalisations), connexion Google en 1 clic.
- **Meta Pixel** : PageView / Lead / Schedule.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind + Prisma. PostgreSQL en prod
(SQLite possible en dev local : basculer `provider` dans `prisma/schema.prisma`).
Intégrations en REST direct (pas de SDK) : Twilio, Resend, Google Calendar/OAuth.
Sans clés API, tout se dégrade en mode simulation (SMS/emails en console).
Cible d'hébergement : Vercel (guide pas à pas dans `app/README.md`).
Docs : `app/ARCHITECTURE.md`.

## Personnalisation actée (ne pas revenir en arrière sans demande)

- Entreprise : **Arboris Paysage** — téléphone **06 14 31 00 02**.
- Logo : `app/public/logo.png` (fourni par le client, optimisé).
- Photos de réalisations : `app/public/realisations/1-3.jpg` (fournies par le
  client, optimisées) — jusqu'à **6** affichées ; gérables aussi depuis l'admin.
- Titre landing : « Le devis pour votre jardin, réservé en 60 secondes ».
- Étapes « comment ça marche » : pastilles numérotées 1-2-3 (pas d'emojis).
  Étape 1 : « Expliquez-nous vos besoins en quelques mots et ajoutez des photos. »
- Types de projet (sans emojis) : Entretien de jardin général, Taille de haie,
  Débroussaillage, Contrat d'entretien à l'année, Autre projet.
- Photos du terrain (prospect) : 6 max.
- Horaires par défaut : lundi-vendredi **16h30 → 20h00** (Thomas fait les
  visites devis en fin de journée). Modifiable dans l'admin.
- Créneaux affichés **toutes les 30 min** (pas = durée de visite) ; le buffer
  trajet (15 min) bloque seulement les créneaux voisins d'un RDV pris.
- Pas de section d'avis clients (retirée) ; seule preuve sociale : la ligne
  « Plus de 100 clients satisfaits » sous le bouton du hero.
- Logo centré en haut de toutes les pages ; numéro déplacé sous la section
  réservation (« Une question ? ») + pied de page. CTA sans emoji.
- Mentions légales : nom légal **Arboris Paysage**, SIRET **914 126 230 00012**,
  adresse **4 place Barbacane, 34360 Saint-Chinian** — page `/mentions-legales`.
- RGPD : bannière de consentement obligatoire avant activation du pixel Meta
  (composant MetaPixel), notice confidentialité à l'étape 2 du tunnel.

## Démo interactive (artifact)

Réplique cliquable du produit, publiée sur claude.ai :
https://claude.ai/code/artifact/991329a6-47a5-4fff-a844-90d29c988b42
Source : conservée dans le scratchpad de session (`demo-rdv-paysagiste.html`) —
si absente (nouvelle session), la reconstruire n'est pas nécessaire sauf demande ;
pour la mettre à jour depuis une autre session, passer l'URL ci-dessus au
paramètre `url` de l'outil Artifact.

**Règle : toute modification visuelle/texte se fait aux DEUX endroits — l'app
réelle (`app/`) ET la démo — puis commit + push + republication de l'artifact.**

## Conventions

- Répondre au client en **français**, ton simple et non technique (il n'est pas
  développeur). Expliquer les limites sans jargon.
- Le client envoie parfois des images dans le chat : elles n'arrivent PAS comme
  fichiers. Pour récupérer de vrais fichiers : upload GitHub par le client, puis
  optimisation avec sharp (photos ~1200px q78, logo PNG trim 600px).
- Commits en anglais, concis. Toujours `git commit` depuis la racine du dépôt
  (pas depuis `app/`).
- Build de vérification : `cd app && npm run build`. Tests manuels : serveur
  local + curl/Playwright (Chromium préinstallé, `/opt/pw-browsers/chromium`).

## Prochaines étapes envisagées

- Déploiement Vercel (compte client à créer, Neon Postgres, variables d'env).
- Clés API à fournir par le client : Google (OAuth + Places), Twilio, Resend,
  Meta Pixel ID.
- Éventuelle PR vers `main` (à la demande du client uniquement).

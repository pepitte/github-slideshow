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
- Les deux boutons du hero (devis / chantier) sont **blancs et identiques**
  (classe `.btn-hero`).
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
- Zone d'intervention par défaut : préfixe **34** (Hérault), adresse de base
  34360 Saint-Chinian ; exemples démo/placeholders en 34, plus aucun exemple 44.
- RGPD : bannière de consentement obligatoire avant activation du pixel Meta
  (composant MetaPixel), notice confidentialité à l'étape 2 du tunnel.

## Espaces & comptes

- **Réservation client** : sans compte (parcours 60 s), 2 types de RDV — devis
  fin de journée 16h30-20h (créneaux 30 min) ; chantier : sélection d'**un ou
  plusieurs jours** (multi-sélection). 1 jour → formule « demi-journée 8h-12h »
  ou « journée entière » ; plusieurs jours → journée entière chacun. Tous les
  chantiers commencent à 8h00 (un seul chantier par jour). Multi-jours = groupe
  de RDV liés (groupId) : un SMS avec la période, une annulation groupée, pas de
  report jour par jour (annuler puis re-réserver).
- **Comptes particuliers** (`/compte`, inscription libre) : retrouvent leurs RDV
  par email (même ceux réservés sans compte), modifier/annuler. **Adresse
  obligatoire à l'inscription** (Client.address/postalCode/city) → le tunnel
  pré-remplit nom, tel, email et adresse pour un client connecté (bandeau vert,
  modifiable si autre adresse). Réservation sans compte inchangée.
- **Espace professionnel** (`/pro`, inscription libre) : statut de dispo (🔵 devis
  / 🟢 chantier / 🟠 sous confirmation / 🔴 indispo — code couleur unifié avec les
  RDV : bleu = devis, vert = chantier), dates, nb de jours, rayon.
  Vue gérant : onglet « Professionnels » dans `/admin`.
- **Connexion unifiée** : `/connexion` (choix particulier / professionnel).
- **Planning patron** (`/admin/planning`, réservé gérant) : calendrier mensuel
  croisant RDV clients (point bleu = devis, vert = chantier) et dispos déclarées
  des pros (carré couleur = statut) ; clic sur un jour → détail (RDV avec tel,
  pros avec statut/créneaux devis/rayon). API `GET /api/admin/planning?month=`.
  Onglet « Planning » aussi dans la démo (vue gérant).
- 3 sessions indépendantes (cookies séparés) : admin, pro, client. Mots de passe
  hachés (scrypt), sessions signées HMAC (AUTH_SECRET).
- **Déploiement** : Vercel plan Hobby (cron rappels 1×/jour à 6h UTC). Fusion des
  PR vers `main` via l'outil GitHub (le client n'a pas à le faire) → redeploy auto.

## Démo interactive (artifact)

Réplique cliquable du produit, publiée sur claude.ai :
https://claude.ai/code/artifact/991329a6-47a5-4fff-a844-90d29c988b42
Source : conservée dans le scratchpad de session (`demo-rdv-paysagiste.html`) —
si absente (nouvelle session), la reconstruire n'est pas nécessaire sauf demande ;
pour la mettre à jour depuis une autre session, passer l'URL ci-dessus au
paramètre `url` de l'outil Artifact.

**Règle : toute modification visuelle/texte se fait aux DEUX endroits — l'app
réelle (`app/`) ET la démo — puis commit + push + republication de l'artifact.**
La démo est un site « une seule page » sans onglets artificiels (choix du
client) : navigation intégrée comme le vrai site — « Se connecter » en haut
(→ choix particulier/pro), « Espace gérant » dans le pied de page.

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

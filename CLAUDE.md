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
  modifiable si autre adresse). Réservation sans compte inchangée. Fiche
  « Mes coordonnées » modifiable dans `/compte` (`PATCH /api/client/me`) :
  alerte orange tant que l'adresse manque (comptes créés avant la nouveauté).
- **Espace professionnel** (`/pro`, inscription libre) : statut de dispo (🔵 devis
  / 🟢 chantier / 🟠 sous confirmation / 🔴 indispo — code couleur unifié avec les
  RDV : bleu = devis, vert = chantier), créneaux devis, dates. **Adresse de
  départ + rayon demandés à l'inscription** (Pro.baseAddress/basePostalCode/
  baseCity/radiusKm) pour connaître le secteur ; la section « Vos informations »
  a été retirée de `/pro`. En bas de `/pro` : **le même agenda que le gérant**
  (composant partagé `AgendaView`, API `GET /api/pro/planning`) mais **sans les
  téléphones** (prop `showContacts`). Vue gérant : onglet « Professionnels »
  dans `/admin` (adresse complète affichée).
- **Connexion unifiée** : `/connexion` (choix particulier / professionnel).
- **Gestion terrain** (`/admin/terrain`, onglet « Terrain ») : pointage des pros
  (modèle WorkEntry, 1 ligne/pro/jour, heure de Paris). Côté pro : carte
  « Ma journée » avec boutons Pointer l'arrivée/le départ (corrigeables,
  `POST /api/pro/pointage`) + badge « Validée par le gérant ». Côté gérant :
  onglets « Fiches & journées » (filtres Aujourd'hui / Cette semaine / Date
  personnalisée, recherche, tableau arrivée/départ/total/statut
  Incomplet-Complet-Validée, bouton Valider) et « Suivi » (totaux par pro).
  Inspiré de la capture « Gestion poseurs » fournie par le client.
- **Planning patron** (`/admin/planning`, réservé gérant) : agenda type
  calendrier avec vues **Mois / Semaine / Jour** (défaut : semaine), navigation
  ← Aujourd'hui →. Semaine/Jour = grille horaire 7h-20h avec RDV en blocs
  colorés (bleu = devis, vert = chantier, chevauchements en colonnes) ; en-têtes
  de jours avec carrés de dispo des pros ; encart « Aujourd'hui » à droite.
  Clic jour/bloc → détail (RDV avec tel, pros avec statut/heures devis/rayon).
  API `GET /api/admin/planning?month=` ou `?from=&to=` (AAAA-MM-JJ).
  Onglet « Planning » identique dans la démo (vue gérant).
- 3 sessions indépendantes (cookies séparés) : admin, pro, client. Mots de passe
  hachés (scrypt), sessions signées HMAC (AUTH_SECRET).
- **Déploiement** : Vercel plan Hobby (cron rappels 1×/jour à 6h UTC). Fusion des
  PR vers `main` via l'outil GitHub (le client n'a pas à le faire) → redeploy auto.

## Démo interactive (artifact)

Réplique cliquable du produit, publiée sur claude.ai :
https://claude.ai/code/artifact/7c97e313-7c8c-4428-9ff7-ce2e4b3836c0
(l'URL précédente `991329a6-…` est devenue impossible à republier — erreur 403
persistante côté service ; elle reste figée sur la version du 3 août.)
Source : conservée dans le scratchpad de session (`demo-arboris-v2.html`) —
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

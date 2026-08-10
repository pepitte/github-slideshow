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
  Lien d'annulation qui libère le créneau. **Alerte au gérant** à chaque
  réservation (`notifyOwnerNewBooking`) : email détaillé + SMS optionnel,
  destinataires via `ownerEmailOf()`/`ownerPhoneOf()` : `Settings.ownerEmail`,
  sinon companyEmail (**l'adresse d'exemple `contact@example.com` est ignorée**,
  sinon elle masquait `ADMIN_EMAIL` et les alertes partaient dans le vide),
  sinon `ADMIN_EMAIL`. Cases à cocher dans les paramètres.
  **Bouton « Envoyer un email de test »** (`POST /api/admin/test-email`) :
  enregistre puis tente un vrai envoi et affiche le diagnostic en français
  (destinataire manquant / clé absente avec la liste des variables `resend` vues
  par le serveur et leur longueur / motif de refus Resend traduit).
- **Anti double-booking** : Google Calendar OAuth (freeBusy en direct) + RDV
  en BDD + revérification du créneau à la soumission. Buffer trajet paramétrable.
- **Créneaux devis des pros réservables (option B, 10 août)** : chaque pro
  « disponible devis » déclare ses créneaux **jour par jour à la demi-heure**
  (`Pro.devisDispoJson` : `{"2026-08-13":["10:00","17:00"]}`). Côté client,
  `getAvailability()` propose l'union horaires du gérant ∪ créneaux des pros
  à portée (un jour fermé côté gérant reste proposé si un pro a déclaré) ;
  une visite réservée sur un créneau pro est attribuée au plus proche
  (`assignDevis`, `notifyProNewDevis`), sinon `proId = null` = visite du
  gérant. Un créneau pris ne bloque que le pro concerné.
- **Attribution automatique des chantiers** (`lib/assign.ts`, choix du client
  10 août) : dès qu'un pro a déclaré des dates chantier (« mode équipe »),
  capacité = **un chantier/jour/pro**, l'agenda Google du gérant ne bloque plus
  les chantiers, et chaque réservation est attribuée au pro **le plus proche à
  portée** (distance CP client ↔ CP du pro ≤ rayon déclaré ; à égalité le moins
  chargé de la semaine ; multi-jours → même pro sur tous les jours si possible).
  Distances via table embarquée `lib/data/cp-gps.json` (6 188 CP français,
  151 Ko, haversine dans `lib/geo.ts`) — aucun service externe. Le tunnel passe
  le CP client (`/api/availability?cp=`) : seuls les jours couverts par un pro à
  portée sont proposés. **Même interlocuteur du devis au chantier** : le pro
  qui a fait la visite devis du client (`proDeLaVisite`, matché par email ou
  téléphone) est prioritaire pour son chantier s'il est éligible. Personne
  d'éligible → `Booking.proId = null` (« À
  attribuer », badge orange admin) + alerte gérant. Désistement pro (« Je ne
  peux pas », `POST /api/pro/missions`, devis comme chantiers) → réattribution
  auto au suivant (`declinedProsJson` anti ping-pong) + `notifyOwnerReassign`. Le gérant
  réattribue via sélecteur dans la fiche (`PATCH /api/admin/bookings/:id
  {proId}`). Le pro attribué est prévenu par email (`notifyProNewChantier`) et
  voit **le téléphone du client** ; les autres pros non (équipe anonymisée :
  ville + prénom). Schéma : `Booking.proId` nullable + `declinedProsJson`,
  sans contrainte unique.
- **Zone d'intervention** : codes postaux (préfixe accepté) ou rayon km ;
  hors zone → message + formulaire de contact (Lead).
- **Espace admin** (`/admin`) : dashboard RDV avec statuts (à faire / devis
  envoyé / gagné / perdu / annulé), paramètres (horaires, congés, zone, durées,
  textes SMS/email, logo, photos de réalisations), connexion Google en 1 clic.
- **Meta Pixel** : PageView / Lead / Schedule. Identifiant réglable depuis
  l'admin (`Settings.metaPixelId`, transmis par le layout au composant
  MetaPixel ; variable d'env en repli). Pixel + bannière RGPD masqués sur
  `/admin` et `/pro` (ils y interceptaient les clics).
- **Publicités Meta** (`/admin/meta`, entrée barre latérale, `lib/meta.ts`) :
  connexion OAuth du compte Facebook/Instagram (scopes pages_show_list,
  pages_manage_metadata, leads_retrieval, business_management), choix de la
  page et abonnement à l'événement `leadgen`. Les prospects des formulaires
  publicitaires arrivent via `/api/meta/webhook` (défi de vérification +
  signature X-Hub-Signature-256 vérifiée en HMAC), sont dédupliqués par
  `Lead.externalId` et déclenchent `notifyOwnerNewLead`. Import de rattrapage
  `POST /api/admin/meta/sync`. `parseLead()` reconnaît les champs anglais,
  français et prénom+nom séparés. **Aucun jeton n'est renvoyé au navigateur**
  (`appSecretSet` seulement) ; un champ secret vide n'efface pas la valeur.
  Le tableau de bord n'affiche que les leads `source: "site"`.
- **Application mobile (PWA)** : `public/manifest.webmanifest` + icônes
  192/512/maskable/apple générées depuis l'emblème du logo, service worker
  `public/sw.js` **volontairement minimal** (cache l'habillage uniquement ;
  intercepter la navigation cassait le préchargement Next.js), composant
  `PwaInstall` (bandeau refermable, bouton Installer, rappel du geste iPhone).

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
  / 🟢 chantier / 🔴 indispo — « sous confirmation » **retiré des choix** le
  10 août (friction inutile, décision client), gardé dans `PRO_STATUS_META`
  pour l'affichage des anciens comptes ; code couleur unifié avec les
  RDV : bleu = devis, vert = chantier). **Adresse de
  départ + rayon demandés à l'inscription** (Pro.baseAddress/basePostalCode/
  baseCity/radiusKm) pour connaître le secteur ; la section « Vos informations »
  a été retirée de `/pro`. **Espace pro restructuré (10 août) : barre latérale
  `ProNav` + `pro/layout.tsx`** (même style que l'admin, rail d'icônes sur
  mobile, absente de login/reinitialiser) avec 4 sections : `/pro` = tableau de
  bord (tuiles cliquables Chantiers/Heures/Statut, carte « Mon prochain
  chantier » avec Itinéraire/Appeler/« Je ne peux pas », aperçu 5 jours),
  `/pro/chantiers` « Chantiers & visites » (liste : ses chantiers en vert,
  ses visites devis en bleu avec badge et heure, équipe en gris ; bascule « Vue
  semaine » vers `AgendaView` sans téléphones), `/pro/pointage` (Ma journée +
  photos), `/pro/disponibilites` **refaite (10 août)** : 3 statuts en boutons,
  puis calendrier — mode chantier : un tap = jour disponible ; mode devis : un
  tap ouvre le panneau du jour (créneaux 30 min 8h→19h30 + raccourcis Fin de
  journée / Matin / Après-midi / Effacer, pastille bleue = nb de créneaux) ;
  tout s'auto-enregistre (`PUT /api/pro/me {devisDispo}`), aucun bouton
  Enregistrer ; indisponible conserve les données.
  Aides partagées dans `pro/shared.ts`. API `GET/POST /api/pro/missions`.
  Vue gérant : onglet « Professionnels » dans `/admin` (adresse complète
  affichée).
- **Connexion unifiée** : `/connexion` (choix particulier / professionnel).
- **Devis manuel** (bouton « Ajouter un devis manuellement », tableau de bord
  gérant) : modale tous champs facultatifs (garde-fou « au moins une info »,
  validations souples email/tel FR), date de RDV facultative → Booking avec
  `source: "manual"` et `startAt/endAt` **nullables** (« Sans date », épinglé en
  tête de liste, badge « Créé manuellement »). Champs coordonnées de Booking
  désormais avec défaut `""`, projectType défaut `autre`. Fiche : notes
  modifiables (bouton explicite) + photos ajout/retrait (10 max,
  `PATCH /api/admin/bookings/:id` accepte status/description/photos). Les RDV
  sans date sont ignorés par dispos/agenda/rappels/Google ; côté client :
  « Date à définir ». `POST /api/admin/bookings` (admin). AddressAutocomplete
  a une prop `optional`.
- **Gestion terrain** (`/admin/terrain`, onglet « Terrain ») : pointage des pros
  (modèle WorkEntry, 1 ligne/pro/jour, heure de Paris). Côté pro : carte
  « Ma journée » avec boutons Pointer l'arrivée/le départ (corrigeables,
  `POST /api/pro/pointage`) + badge « Validée par le gérant ». Côté gérant :
  onglets « Fiches & journées » (filtres Aujourd'hui / Cette semaine / Date
  personnalisée, recherche, tableau arrivée/départ/total/statut
  Incomplet-Complet-Validée, bouton Valider) et « Suivi » (totaux par pro).
  Inspiré de la capture « Gestion poseurs » fournie par le client.
  **Photos avant/après chantier** : le pro en joint jusqu'à 4 de chaque à sa
  journée (PhotoUpload, auto-enregistrées via `PUT /api/pro/pointage`,
  WorkEntry.photosBefore/AfterJson) ; le gérant les voit dans le tableau
  (colonne Photos, ligne dépliable de miniatures).
  **Rattrapage d'un oubli de pointage** : le pro choisit la journée (jusqu'à
  7 jours en arrière, futur refusé) et `POST /api/pro/pointage` accepte un
  `time` HH:mm ; le gérant corrige arrivée/départ directement dans le tableau
  (`PATCH /api/admin/terrain` avec arrival/departure, "" pour effacer) et peut
  créer une journée vide (`POST /api/admin/terrain {proId, date}`).
  **Export Excel** : bouton « Exporter pour Excel » →
  `GET /api/admin/terrain/export?from=&to=`, CSV (BOM UTF-8, séparateur `;`,
  heures en h:mm et en décimal à virgule, ligne TOTAL) ouvrable tel quel dans
  Excel FR — pour la paie et la facturation des sous-traitants.
- **Devis & Factures** (`/admin/facturation`, entrée barre latérale) : modèle
  Document (type devis/facture, numéro unique auto D-2026-001 / F-2026-001,
  lignes itemsJson label/qty/unit/unitPrice, TVA 0/10/20 avec mention art. 293 B
  à 0 %, statuts devis brouillon/envoyé/accepté/refusé et facture à payer/payée).
  Liste à onglets + éditeur `/admin/facturation/[id]` avec aperçu imprimable à
  l'en-tête (logo, coordonnées, SIRET), bouton Imprimer/PDF (window.print,
  formulaire et sidebar en print:hidden), « Transformer en facture », suppression.
  APIs `GET/POST /api/admin/documents`, `GET/PATCH/DELETE /api/admin/documents/:id`.
- **Statistiques** (`/admin/stats`, entrée barre latérale, API
  `GET /api/admin/stats`) : tuiles (RDV à venir, taux de devis gagnés, facturé
  cette année, reste à encaisser), RDV par semaine sur 12 semaines (barres
  empilées bleu = devis / vert = chantier + tableau des chiffres dépliable),
  répartition par statut, CA facturé par mois sur 12 mois (encaissé / en
  attente). Le taux de transformation ne compte que les dossiers décidés
  (gagnés + perdus). Graphiques en CSS pur (aucune librairie), couleurs
  #2563eb / #16a34a validées pour le daltonisme.
- **Espace gérant** : barre latérale gauche (layout `/admin`, composant AdminNav)
  avec logo, icônes SVG (Tableau de bord, Agenda, Gestion terrain, Statistiques,
  Devis & Factures, Professionnels, Paramètres) et Déconnexion en bas ; rail d'icônes seul sur
  mobile ; absente de `/admin/login`. Inspirée de la maquette du client.
  Tableau de bord : **recherche** (nom, tel, email, ville, CP, adresse,
  description) et **RDV annulés masqués par défaut** (case « Annulés »).
  Liste des professionnels : lien « Retirer » (confirmation) →
  `DELETE /api/admin/pros/:id`, pointages supprimés en cascade.
- **Planning patron** (`/admin/planning`, réservé gérant) : agenda type
  calendrier avec vues **Mois / Semaine / Jour** (défaut : semaine), navigation
  ← Aujourd'hui →. Semaine/Jour = grille horaire 7h-20h avec RDV en blocs
  colorés (bleu = devis, vert = chantier, chevauchements en colonnes) ; en-têtes
  de jours avec carrés de dispo des pros ; encart « Aujourd'hui » à droite.
  Clic jour/bloc → détail (RDV avec tel, pros avec statut/heures devis/rayon).
  API `GET /api/admin/planning?month=` ou `?from=&to=` (AAAA-MM-JJ).
  Onglet « Planning » identique dans la démo (vue gérant).
- 3 sessions indépendantes (cookies séparés) : admin, pro, client. Mots de passe
  hachés (scrypt), sessions signées HMAC (AUTH_SECRET). **Mot de passe oublié**
  pour clients et pros : lien « Mot de passe oublié ? » sur les pages de
  connexion → email avec lien 1 h à usage unique (`/compte/reinitialiser`,
  `/pro/reinitialiser`, composant partagé PasswordResetForm) ; nécessite la clé
  Resend en prod (sinon email simulé en console). **Limite de tentatives**
  (`lib/rateLimit.ts`, compteur mémoire par IP) sur les 3 pages de connexion :
  3 échecs → 429 « Trop de tentatives » pendant 15 min, remise à zéro au succès.
- **Déploiement** : Vercel plan Hobby (cron rappels 1×/jour à 6h UTC). Fusion des
  PR vers `main` via l'outil GitHub (le client n'a pas à le faire) → redeploy auto.

## Démo interactive (artifact)

Réplique cliquable du produit, publiée sur claude.ai :
https://claude.ai/code/artifact/7c97e313-7c8c-4428-9ff7-ce2e4b3836c0
(l'URL précédente `991329a6-…` est devenue impossible à republier — erreur 403
persistante côté service ; elle reste figée sur la version du 3 août.)
Source : `demo-arboris-v2.html` dans le scratchpad de session. **Le stockage
temporaire peut être vidé en cours de session** (c'est arrivé le 9 août : le
fichier et `node_modules` ont disparu, `npm ci` a suffi pour l'app mais la démo
était perdue). La démo publiée reste en ligne dans sa dernière version publiée ;
la reconstruire n'est pas nécessaire sauf demande du client. Pour la mettre à
jour depuis une autre session, passer l'URL ci-dessus au paramètre `url` de
l'outil Artifact.
**Version publiée : tout jusqu'aux statistiques ; la section Publicités Meta
n'y figure pas.**

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
- **Resend : configuré en production le 9 août** (compte au nom de
  arborispaysagecontact@gmail.com, `RESEND_API_KEY` dans Vercel). Les alertes au
  gérant arrivent réellement. Piège rencontré : la variable avait été enregistrée
  **vide** — le bouton de test le dit maintenant explicitement (« 0 caractères »).
  Rappel : sans domaine vérifié, Resend n'écrit qu'à l'adresse propriétaire du
  compte, donc **les emails de confirmation aux clients ne partent pas encore**.
- Clés API restant à fournir : Google (OAuth + Places), Twilio, Meta Pixel ID.
- Nom de domaine personnalisé (l'icône PWA affichera alors le vrai domaine).
- Validation serveur email/téléphone sur `/api/bookings` (le formulaire bloque
  déjà les valeurs invalides, l'API publique non) — signalé au client, non
  demandé à ce jour.
- Éventuelle PR vers `main` (à la demande du client uniquement).

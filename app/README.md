# 🌿 RDV Devis Paysagiste

Plateforme de prise de rendez-vous de devis pour entreprise de paysagisme :
landing page mobile-first, réservation en moins de 60 secondes, synchronisation
Google Agenda temps réel, SMS automatiques (confirmation + rappels 24 h / 1 h),
email avec invitation `.ics`, espace admin complet.

👉 Architecture détaillée et écrans clés : [ARCHITECTURE.md](./ARCHITECTURE.md)

## Déployer sur Vercel (recommandé — 5 minutes)

1. Sur [vercel.com](https://vercel.com), connectez-vous avec votre compte GitHub et
   cliquez **Add New → Project**, puis importez ce dépôt.
2. Dans la configuration du projet, réglez **Root Directory** sur `app`
   (le framework Next.js est détecté automatiquement).
3. Onglet **Storage** (ou pendant l'import) : ajoutez une base **Neon Postgres**
   (gratuite) — la variable `DATABASE_URL` est créée automatiquement.
4. Dans **Environment Variables**, ajoutez :
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — vos identifiants d'accès admin
   - `AUTH_SECRET` — une chaîne aléatoire longue (ex. `openssl rand -hex 32`)
   - `CRON_SECRET` — idem, protège la route des rappels SMS
5. Cliquez **Deploy**. Les tables sont créées automatiquement au build
   (`vercel-build` exécute `prisma db push`).
6. Après le premier déploiement, ajoutez `NEXT_PUBLIC_APP_URL` =
   `https://votre-projet.vercel.app` et redéployez (liens d'annulation des SMS).

Votre app est alors accessible depuis n'importe quel téléphone :
`https://votre-projet.vercel.app` (public) et `/admin` (gérant).

## Démarrage rapide (dev local)

```bash
cd app
cp .env.example .env        # renseignez DATABASE_URL (Postgres), ADMIN_EMAIL / ADMIN_PASSWORD / AUTH_SECRET
npm install
npx prisma db push          # crée les tables
npm run dev                 # http://localhost:3000
```

Pas de Postgres sous la main ? Mettez `provider = "sqlite"` dans
`prisma/schema.prisma` et `DATABASE_URL="file:./dev.db"` dans `.env`.

Sans clés externes, l'app fonctionne en **mode simulation** : les SMS et emails
sont affichés dans la console du serveur, les créneaux se calculent sur la seule
base des RDV enregistrés, et l'adresse se saisit manuellement.

- Site public : `http://localhost:3000`
- Espace gérant : `http://localhost:3000/admin` (identifiants du `.env`)

## Activer les intégrations

| Intégration | Variables | Notes |
|---|---|---|
| **Google Agenda** (synchro bidirectionnelle) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Créez un client OAuth 2.0 (type Web) dans Google Cloud Console, avec l'URI de redirection `https://votre-domaine/api/google/callback`. Le gérant se connecte ensuite en 1 clic depuis Admin → Paramètres. |
| **Google Places / Geocoding** (autocomplétion + zone par rayon) | `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Activez Places API + Geocoding API. |
| **SMS Twilio** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | N'importe quel numéro SMS Twilio. Les textes sont personnalisables dans l'admin. |
| **Email Resend** | `RESEND_API_KEY`, `EMAIL_FROM` | L'email de confirmation embarque le fichier `.ics`. |
| **Meta Pixel** | `NEXT_PUBLIC_META_PIXEL_ID` | Événements `PageView`, `Lead`, `Schedule` (conversion). |

## Rappels SMS (cron)

`GET /api/cron/reminders` (header `Authorization: Bearer $CRON_SECRET`) envoie les
rappels 24 h et 1 h. Sur Vercel plan Hobby, `vercel.json` le programme une fois par
jour à 6h UTC (limite du plan gratuit) : le rappel « 24 h » devient un rappel le
matin du RDV. Pour des rappels précis (dont le 1 h avant), appelez la route toutes
les 10 minutes depuis un cron externe gratuit type cron-job.org :

```
*/10 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/reminders
```

## Production

- **Base de données** : PostgreSQL par défaut (Neon, Supabase…). SQLite reste
  possible en dev local uniquement (voir ci-dessus) — pas sur du serverless.
- **Photos** : stockées en base64 dans la BDD (MVP). Pour du volume, branchez S3
  ou Cloudinary dans `src/app/api/bookings/route.ts`.
- `NEXT_PUBLIC_APP_URL` doit être l'URL publique (liens d'annulation dans les SMS).

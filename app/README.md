# 🌿 RDV Devis Paysagiste

Plateforme de prise de rendez-vous de devis pour entreprise de paysagisme :
landing page mobile-first, réservation en moins de 60 secondes, synchronisation
Google Agenda temps réel, SMS automatiques (confirmation + rappels 24 h / 1 h),
email avec invitation `.ics`, espace admin complet.

👉 Architecture détaillée et écrans clés : [ARCHITECTURE.md](./ARCHITECTURE.md)

## Démarrage rapide (dev)

```bash
cd app
cp .env.example .env        # puis renseignez au minimum ADMIN_EMAIL / ADMIN_PASSWORD / AUTH_SECRET
npm install
npx prisma db push          # crée la base SQLite
npm run dev                 # http://localhost:3000
```

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
rappels 24 h et 1 h. Sur Vercel, `vercel.json` le programme toutes les 10 minutes ;
ailleurs, utilisez n'importe quel cron :

```
*/10 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/reminders
```

## Production

- **Base de données** : passez `provider = "postgresql"` dans `prisma/schema.prisma`
  et pointez `DATABASE_URL` vers PostgreSQL (Neon, Supabase…). SQLite ne convient
  pas aux plateformes serverless.
- **Photos** : stockées en base64 dans la BDD (MVP). Pour du volume, branchez S3
  ou Cloudinary dans `src/app/api/bookings/route.ts`.
- `NEXT_PUBLIC_APP_URL` doit être l'URL publique (liens d'annulation dans les SMS).

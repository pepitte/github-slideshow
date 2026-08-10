"use client";

// Paramètres gérant : entreprise, Google Agenda, horaires, zones, messages.
import { useEffect, useRef, useState } from "react";
import PhotoUpload from "@/components/PhotoUpload";

/** Redimensionne le logo côté client (max 600 px de large, PNG). */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

type OpeningDay = { enabled: boolean; start: string; end: string };
type DayOff = { from: string; to: string; label?: string };

type SettingsView = {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  baseAddress: string;
  logoUrl: string;
  zoneMode: string;
  postalCodesJson: string;
  radiusKm: number;
  visitDurationMin: number;
  bufferMin: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  openingHoursJson: string;
  chantierEnabled: boolean;
  chantierDurationMin: number;
  chantierHoursJson: string;
  daysOffJson: string;
  notifyOwnerEmail: boolean;
  notifyOwnerSms: boolean;
  ownerEmail: string;
  ownerPhone: string;
  emailFrom: string;
  emailConfigured: boolean;
  emailClientsOk: boolean;
  proFilterMode: string;
  smsConfirmation: string;
  smsReminder24h: string;
  smsReminder1h: string;
  emailSubject: string;
  emailBody: string;
  googleConnected: boolean;
  googleConfigured: boolean;
  googleEmail: string;
};

const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function AdminSettingsPage() {
  const [s, setS] = useState<SettingsView | null>(null);
  const [postalCodes, setPostalCodes] = useState("");
  const [hours, setHours] = useState<Record<string, OpeningDay>>({});
  const [chantierHours, setChantierHours] = useState<Record<string, OpeningDay>>({});
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testOk, setTestOk] = useState(false);
  const [testing, setTesting] = useState(false);
  // Test d'envoi vers une adresse quelconque : le seul moyen de vérifier que
  // les confirmations partent vraiment aux clients.
  const [testClientTo, setTestClientTo] = useState("");
  const [testClientMsg, setTestClientMsg] = useState("");
  const [testClientOk, setTestClientOk] = useState(false);
  const [testingClient, setTestingClient] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [gallerySaved, setGallerySaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/gallery")
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((data) => setGallery(data.photos ?? []))
      .catch(() => {});
  }, []);

  async function updateGallery(photos: string[]) {
    setGallery(photos);
    setGallerySaved(false);
    const res = await fetch("/api/admin/gallery", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos }),
    });
    if (res.ok) {
      setGallerySaved(true);
      setTimeout(() => setGallerySaved(false), 2500);
    }
  }

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then(({ settings }) => {
        setS(settings);
        try {
          setPostalCodes(JSON.parse(settings.postalCodesJson).join(", "));
        } catch {}
        try {
          setHours(JSON.parse(settings.openingHoursJson) || {});
        } catch {}
        try {
          setChantierHours(JSON.parse(settings.chantierHoursJson) || {});
        } catch {}
        try {
          setDaysOff(JSON.parse(settings.daysOffJson) || []);
        } catch {}
      });
  }, []);

  if (!s) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="py-8 text-center text-leaf-800/60">Chargement…</p>
      </main>
    );
  }

  const set = (patch: Partial<SettingsView>) => setS({ ...s, ...patch });

  async function save() {
    if (!s) return;
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: s.companyName,
        companyPhone: s.companyPhone,
        companyEmail: s.companyEmail,
        baseAddress: s.baseAddress,
        logoUrl: s.logoUrl,
        zoneMode: s.zoneMode,
        postalCodes: postalCodes.split(/[,;\s]+/).map((c) => c.trim()).filter(Boolean),
        radiusKm: s.radiusKm,
        visitDurationMin: s.visitDurationMin,
        bufferMin: s.bufferMin,
        minNoticeHours: s.minNoticeHours,
        maxDaysAhead: s.maxDaysAhead,
        openingHours: hours,
        chantierEnabled: s.chantierEnabled,
        chantierDurationMin: s.chantierDurationMin,
        chantierHours,
        daysOff,
        notifyOwnerEmail: s.notifyOwnerEmail,
        notifyOwnerSms: s.notifyOwnerSms,
        ownerEmail: s.ownerEmail,
        emailFrom: s.emailFrom,
        ownerPhone: s.ownerPhone,
        proFilterMode: s.proFilterMode,
        smsConfirmation: s.smsConfirmation,
        smsReminder24h: s.smsReminder24h,
        smsReminder1h: s.smsReminder1h,
        emailSubject: s.emailSubject,
        emailBody: s.emailBody,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  // Envoi d'essai : enregistre d'abord, puis dit en clair si l'email part.
  async function testerEmail() {
    setTesting(true);
    setTestMsg("");
    await save();
    const res = await fetch("/api/admin/test-email", { method: "POST" });
    const data = await res.json();
    setTesting(false);
    setTestOk(Boolean(data.ok));
    setTestMsg(data.message ?? data.error ?? "Test impossible.");
  }

  // Test « côté client » : on écrit à une adresse choisie, comme le ferait une
  // confirmation de rendez-vous.
  async function testerEmailClient() {
    setTestingClient(true);
    setTestClientMsg("");
    await save();
    const res = await fetch("/api/admin/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testClientTo.trim() }),
    });
    const data = await res.json();
    setTestingClient(false);
    setTestClientOk(Boolean(data.ok));
    setTestClientMsg(data.message ?? data.error ?? "Test impossible.");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold">Paramètres</h1>

      <div className="space-y-6">
        {/* Google Agenda */}
        <section className="card space-y-3">
          <h2 className="font-bold">Google Agenda</h2>
          {s.googleConnected ? (
            <p className="text-sm text-leaf-800">
              ✓ Connecté {s.googleEmail && <span className="font-semibold">({s.googleEmail})</span>} —
              les créneaux proposés tiennent compte de votre agenda et chaque RDV y est ajouté.
            </p>
          ) : s.googleConfigured ? (
            <>
              <p className="text-sm text-leaf-800/70">
                Connectez votre compte Google pour synchroniser les disponibilités en temps réel
                et éviter tout double booking.
              </p>
              <a href="/api/google/connect" className="btn-primary">
                Connecter mon Google Agenda
              </a>
            </>
          ) : (
            <p className="text-sm text-amber-700">
              Renseignez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans les variables
              d&apos;environnement pour activer la connexion Google.
            </p>
          )}
        </section>

        {/* Entreprise */}
        <section className="card space-y-3">
          <h2 className="font-bold">Entreprise & branding</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nom de l&apos;entreprise</label>
              <input className="input" value={s.companyName} onChange={(e) => set({ companyName: e.target.value })} />
            </div>
            <div>
              <label className="label">Téléphone (affiché aux clients)</label>
              <input className="input" value={s.companyPhone} onChange={(e) => set({ companyPhone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={s.companyEmail} onChange={(e) => set({ companyEmail: e.target.value })} />
            </div>
            <div>
              <label className="label">Logo</label>
              {s.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt="Logo" className="mb-2 h-12 w-auto rounded-lg bg-white object-contain" />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => logoInputRef.current?.click()}>
                  {s.logoUrl ? "Changer…" : "Choisir une image…"}
                </button>
                {s.logoUrl && (
                  <button type="button" className="btn-secondary" onClick={() => set({ logoUrl: "" })}>
                    Retirer
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) set({ logoUrl: await fileToLogoDataUrl(file) });
                  e.target.value = "";
                }}
              />
              <p className="mt-1 text-xs text-leaf-800/60">
                Pensez à cliquer « Enregistrer les paramètres » en bas de page.
              </p>
            </div>
          </div>
          <div>
            <label className="label">Adresse de départ (dépôt / siège, pour le mode rayon)</label>
            <input className="input" value={s.baseAddress} onChange={(e) => set({ baseAddress: e.target.value })} />
          </div>
        </section>

        {/* Photos de réalisations */}
        <section className="card space-y-3">
          <h2 className="font-bold">
            Photos de réalisations
            {gallerySaved && <span className="ml-2 text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
          </h2>
          <p className="text-sm text-leaf-800/70">
            Affichées en vitrine sur la page de réservation. Ajoutez-les directement
            depuis votre téléphone — elles sont compressées et publiées immédiatement.
          </p>
          <PhotoUpload photos={gallery} onChange={updateGallery} label="6 photos maximum" maxPhotos={6} />
        </section>

        {/* Zone d'intervention */}
        <section className="card space-y-3">
          <h2 className="font-bold">Zone d&apos;intervention</h2>
          <div className="flex gap-2">
            {[
              { id: "postal", label: "Codes postaux" },
              { id: "radius", label: "Rayon (km)" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => set({ zoneMode: m.id })}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  s.zoneMode === m.id ? "bg-leaf-600 text-white" : "bg-leaf-100 text-leaf-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {s.zoneMode === "postal" ? (
            <div>
              <label className="label">
                Codes postaux couverts (séparés par des virgules — un préfixe comme « 44 » couvre tout le département)
              </label>
              <textarea className="input" value={postalCodes} onChange={(e) => setPostalCodes(e.target.value)} placeholder="44000, 44100, 44300, 44800…" />
            </div>
          ) : (
            <div>
              <label className="label">Rayon autour de l&apos;adresse de départ (km)</label>
              <input
                className="input max-w-[8rem]"
                type="number"
                min={1}
                value={s.radiusKm}
                onChange={(e) => set({ radiusKm: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-leaf-800/60">
                Nécessite GOOGLE_MAPS_API_KEY (géocodage). Sinon, la liste de codes postaux sert de secours.
              </p>
            </div>
          )}
        </section>

        {/* Paramètres RDV */}
        <section className="card space-y-3">
          <h2 className="font-bold">⏱️ Rendez-vous</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["visitDurationMin", "Durée visite (min)"],
                ["bufferMin", "Buffer trajet (min)"],
                ["minNoticeHours", "Préavis mini (h)"],
                ["maxDaysAhead", "Jours ouverts à la résa"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={s[key]}
                  onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<SettingsView>)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Horaires */}
        <section className="card space-y-2">
          <h2 className="font-bold">Horaires d&apos;ouverture</h2>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const day = hours[String(d)] ?? { enabled: false, start: "08:00", end: "18:00" };
            return (
              <div key={d} className="flex items-center gap-3 text-sm">
                <label className="flex w-28 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => setHours({ ...hours, [d]: { ...day, enabled: e.target.checked } })}
                  />
                  {DAY_NAMES[d]}
                </label>
                <input
                  type="time"
                  className="input max-w-[7.5rem] py-2"
                  value={day.start}
                  disabled={!day.enabled}
                  onChange={(e) => setHours({ ...hours, [d]: { ...day, start: e.target.value } })}
                />
                <span>→</span>
                <input
                  type="time"
                  className="input max-w-[7.5rem] py-2"
                  value={day.end}
                  disabled={!day.enabled}
                  onChange={(e) => setHours({ ...hours, [d]: { ...day, end: e.target.value } })}
                />
              </div>
            );
          })}
        </section>

        {/* Rendez-vous chantier */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Rendez-vous chantier</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.chantierEnabled}
                onChange={(e) => set({ chantierEnabled: e.target.checked })}
              />
              Proposer ce type de RDV
            </label>
          </div>
          {s.chantierEnabled && (
            <>
              <p className="text-sm text-leaf-800/70">
                Le client choisit un jour puis une formule : <b>demi-journée (8h → 12h)</b> ou{" "}
                <b>journée entière</b> (8h → fin d&apos;horaire). Tous les chantiers commencent
                à l&apos;heure d&apos;ouverture ci-dessous.
              </p>
              <div className="space-y-2">
                <span className="label">Horaires des chantiers (en journée, dès 8h)</span>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const day = chantierHours[String(d)] ?? { enabled: false, start: "08:00", end: "18:00" };
                  return (
                    <div key={d} className="flex items-center gap-3 text-sm">
                      <label className="flex w-28 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(e) =>
                            setChantierHours({ ...chantierHours, [d]: { ...day, enabled: e.target.checked } })
                          }
                        />
                        {DAY_NAMES[d]}
                      </label>
                      <input
                        type="time"
                        className="input max-w-[7.5rem] py-2"
                        value={day.start}
                        disabled={!day.enabled}
                        onChange={(e) =>
                          setChantierHours({ ...chantierHours, [d]: { ...day, start: e.target.value } })
                        }
                      />
                      <span>→</span>
                      <input
                        type="time"
                        className="input max-w-[7.5rem] py-2"
                        value={day.end}
                        disabled={!day.enabled}
                        onChange={(e) =>
                          setChantierHours({ ...chantierHours, [d]: { ...day, end: e.target.value } })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Alertes gérant */}
        <section className="card space-y-3">
          <h2 className="font-bold">Être prévenu des nouvelles réservations</h2>
          <p className="text-sm text-leaf-800/70">
            Dès qu&apos;un client réserve, recevez le détail du rendez-vous sans ouvrir le tableau de bord.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.notifyOwnerEmail}
              onChange={(e) => set({ notifyOwnerEmail: e.target.checked })}
            />
            Me prévenir par email
          </label>
          <input
            className="input"
            type="email"
            placeholder="Email qui reçoit les alertes (par défaut : email de l'entreprise)"
            value={s.ownerEmail}
            onChange={(e) => set({ ownerEmail: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.notifyOwnerSms}
              onChange={(e) => set({ notifyOwnerSms: e.target.checked })}
            />
            Me prévenir par SMS
          </label>
          <input
            className="input"
            type="tel"
            placeholder="Numéro qui reçoit les SMS (par défaut : téléphone de l'entreprise)"
            value={s.ownerPhone}
            onChange={(e) => set({ ownerPhone: e.target.value })}
          />
          <p className="text-xs text-leaf-800/60">
            Les SMS nécessitent la clé Twilio, les emails la clé Resend. Sans clé, les messages
            s&apos;affichent seulement dans les journaux techniques.
          </p>
          <div className="border-t border-leaf-100 pt-3">
            <button className="btn-secondary" onClick={testerEmail} disabled={testing}>
              {testing ? "Envoi en cours…" : "Envoyer un email de test"}
            </button>
            {testMsg && (
              <p
                className={`mt-2 rounded-xl px-3 py-2 text-sm ${
                  testOk ? "bg-leaf-50 text-leaf-800" : "bg-red-50 text-red-700"
                }`}
              >
                {testMsg}
              </p>
            )}
          </div>
        </section>

        {/* Emails envoyés aux clients */}
        <section className="card space-y-3">
          <h2 className="font-bold">Emails envoyés à vos clients</h2>
          <p
            className={`rounded-xl px-3 py-2 text-sm ${
              s.emailClientsOk ? "bg-leaf-50 text-leaf-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {!s.emailConfigured ? (
              <>
                <b>Aucun email ne part pour l&apos;instant.</b> La clé Resend n&apos;est pas active
                sur le site.
              </>
            ) : s.emailClientsOk ? (
              <>
                <b>✓ Vos clients reçoivent bien leur confirmation</b>, envoyée depuis{" "}
                <b>{s.emailFrom}</b>. Vérifiez-le de temps en temps avec le bouton de test
                ci-dessous.
              </>
            ) : (
              <>
                <b>Vos clients ne reçoivent PAS leur confirmation.</b> Sans adresse d&apos;expédition
                à vous, Resend n&apos;écrit qu&apos;au propriétaire du compte — donc à vous seul.
                Marche à suivre : vérifiez votre nom de domaine dans Resend (il vous donne des lignes
                à recopier chez OVH), puis indiquez ci-dessous l&apos;adresse d&apos;expédition.
              </>
            )}
          </p>
          <div>
            <span className="label">Adresse qui apparaît comme expéditeur</span>
            <input
              className="input"
              placeholder="Arboris Paysage <contact@arborispaysage.eu>"
              value={s.emailFrom}
              onChange={(e) => set({ emailFrom: e.target.value })}
            />
            <p className="mt-1 text-xs text-leaf-800/60">
              Le domaine de cette adresse doit être vérifié dans Resend. Laissez vide tant que ce
              n&apos;est pas fait : les alertes continueront de vous parvenir.
            </p>
          </div>
          <div className="border-t border-leaf-100 pt-3">
            <span className="label">Vérifier qu&apos;un client reçoit bien l&apos;email</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                type="email"
                placeholder="Une autre adresse à vous (Gmail, Orange…)"
                value={testClientTo}
                onChange={(e) => setTestClientTo(e.target.value)}
              />
              <button
                className="btn-secondary whitespace-nowrap"
                onClick={testerEmailClient}
                disabled={testingClient || !testClientTo.trim()}
              >
                {testingClient ? "Envoi en cours…" : "Envoyer un test"}
              </button>
            </div>
            <p className="mt-1 text-xs text-leaf-800/60">
              Utilisez une adresse <b>différente</b> de celle de votre compte Resend : c&apos;est la
              seule façon de prouver que vos clients reçoivent vraiment leurs confirmations.
            </p>
            {testClientMsg && (
              <p
                className={`mt-2 rounded-xl px-3 py-2 text-sm ${
                  testClientOk ? "bg-leaf-50 text-leaf-800" : "bg-red-50 text-red-700"
                }`}
              >
                {testClientMsg}
              </p>
            )}
          </div>
        </section>

        {/* Disponibilité des professionnels */}
        <section className="card space-y-3">
          <h2 className="font-bold">Créneaux et disponibilité des professionnels</h2>
          <p className="text-sm text-leaf-800/70">
            Ne proposer aux clients que les créneaux couverts par au moins un professionnel qui
            s&apos;est déclaré disponible.
          </p>
          {[
            { v: "off", label: "Non — proposer tous les créneaux libres" },
            { v: "chantier", label: "Chantiers seulement (recommandé)" },
            { v: "tous", label: "Chantiers et visites devis" },
          ].map((o) => (
            <label key={o.v} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="proFilterMode"
                checked={s.proFilterMode === o.v}
                onChange={() => set({ proFilterMode: o.v })}
              />
              {o.label}
            </label>
          ))}
          <p className="text-xs text-leaf-800/60">
            Sécurité : tant qu&apos;aucun professionnel n&apos;a rempli son planning, le filtre est
            ignoré — votre site continue de proposer des créneaux.
          </p>
        </section>

        {/* Congés */}
        <section className="card space-y-3">
          <h2 className="font-bold">Congés / indisponibilités</h2>
          {daysOff.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input
                type="date"
                className="input max-w-[11rem] py-2"
                value={d.from}
                onChange={(e) => setDaysOff(daysOff.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}
              />
              <span>→</span>
              <input
                type="date"
                className="input max-w-[11rem] py-2"
                value={d.to}
                onChange={(e) => setDaysOff(daysOff.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
              />
              <button className="text-red-600" onClick={() => setDaysOff(daysOff.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn-secondary"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              setDaysOff([...daysOff, { from: today, to: today }]);
            }}
          >
            + Ajouter une période
          </button>
        </section>

        {/* Messages */}
        <section className="card space-y-3">
          <h2 className="font-bold">Textes SMS & email</h2>
          <p className="text-xs text-leaf-800/60">
            Variables : {"{{prenom}} {{nom}} {{date}} {{heure}} {{adresse}} {{entreprise}} {{telephone}} {{lien_annulation}}"}
          </p>
          {(
            [
              ["smsConfirmation", "SMS de confirmation (immédiat)"],
              ["smsReminder24h", "SMS rappel 24 h avant"],
              ["smsReminder1h", "SMS rappel 1 h avant"],
              ["emailSubject", "Objet de l'email de confirmation"],
              ["emailBody", "Corps de l'email de confirmation"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <textarea
                className={`input ${key === "emailBody" ? "min-h-[140px]" : "min-h-[70px]"}`}
                value={s[key]}
                onChange={(e) => set({ [key]: e.target.value } as Partial<SettingsView>)}
              />
            </div>
          ))}
        </section>

        <div className="sticky bottom-4 flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
          </button>
          {saved && <span className="text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
        </div>
      </div>
    </main>
  );
}

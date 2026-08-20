"use client";

// Publicités Meta : connexion du compte Facebook/Instagram et réception des
// prospects laissés dans les formulaires publicitaires (leads).
import { useEffect, useState } from "react";

type Lead = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  postalCode: string;
  message: string;
  source: string;
  formName: string;
  adName: string;
  campaign: string;
  handled: boolean;
};

type Status = {
  appId: string;
  appSecretSet: boolean;
  pixelId: string;
  pageId: string;
  pageName: string;
  pageConnected: boolean;
  accountConnected: boolean;
  connectedAt: string | null;
  leadsEnabled: boolean;
  verifyToken: string;
  webhookUrl: string;
  redirectUri: string;
  leads: Lead[];
  aTraiter: number;
};

const MESSAGES: Record<string, string> = {
  ok: "Compte Meta connecté et page reliée : les prospects arriveront ici automatiquement.",
  choisir_page: "Compte connecté. Choisissez la page Facebook qui diffuse vos publicités.",
  aucune_page: "Compte connecté, mais aucune page Facebook n'y est rattachée.",
  refuse: "Connexion annulée.",
  erreur: "La connexion a échoué. Vérifiez l'identifiant et la clé secrète de votre application Meta.",
  etat_invalide: "Connexion expirée, recommencez.",
  non_configure: "Renseignez d'abord l'identifiant et la clé secrète de votre application Meta.",
};

function Copiable({ label, value }: { label: string; value: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-sand-50 px-3 py-2 text-xs text-leaf-900">
          {value}
        </code>
        <button
          className="btn-secondary shrink-0 !py-2"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopie(true);
            setTimeout(() => setCopie(false), 2000);
          }}
        >
          {copie ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export default function AdminMetaPage() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [info, setInfo] = useState("");
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);

  function apply(data: Status) {
    setS(data);
    setAppId(data.appId);
    setPixelId(data.pixelId);
  }

  useEffect(() => {
    const retour = new URLSearchParams(window.location.search).get("meta");
    if (retour) setInfo(MESSAGES[retour] ?? "");
    fetch("/api/admin/meta")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then(apply)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    setErreur("");
    const res = await fetch("/api/admin/meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, appSecret, pixelId }),
    });
    setBusy(false);
    if (res.ok) {
      apply(await res.json());
      setAppSecret("");
      setInfo("Réglages enregistrés.");
    } else setErreur("Enregistrement impossible.");
  }

  async function loadPages() {
    setBusy(true);
    setErreur("");
    const res = await fetch("/api/admin/meta/pages");
    const data = await res.json();
    setBusy(false);
    if (res.ok) setPages(data.pages ?? []);
    else setErreur(data.error ?? "Pages introuvables.");
  }

  async function choosePage(pageId: string) {
    setBusy(true);
    setErreur("");
    const res = await fetch("/api/admin/meta/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErreur(data.error ?? "Page non reliée.");
    setPages([]);
    setInfo("Page reliée : les nouveaux prospects arriveront automatiquement.");
    fetch("/api/admin/meta").then((r) => r.json()).then(apply);
  }

  async function importer() {
    setBusy(true);
    setErreur("");
    const res = await fetch("/api/admin/meta/sync", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErreur(data.error ?? "Import impossible.");
    setInfo(
      data.imported
        ? `${data.imported} nouveau(x) prospect(s) importé(s).`
        : "Aucun nouveau prospect à importer."
    );
    fetch("/api/admin/meta").then((r) => r.json()).then(apply);
  }

  async function deconnecter() {
    if (!window.confirm("Déconnecter votre compte Meta ? Les prospects déjà reçus sont conservés."))
      return;
    const res = await fetch("/api/admin/meta", { method: "DELETE" });
    if (res.ok) {
      apply(await res.json());
      setInfo("Compte Meta déconnecté.");
    }
  }

  async function setHandled(lead: Lead, handled: boolean) {
    const res = await fetch(`/api/admin/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handled }),
    });
    if (res.ok && s) {
      setS({
        ...s,
        leads: s.leads.map((l) => (l.id === lead.id ? { ...l, handled } : l)),
        aTraiter: s.aTraiter + (handled ? -1 : 1),
      });
    }
  }

  if (loading) return <main className="px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  if (!s) return <main className="px-4 py-10 text-center text-leaf-800/60">Section indisponible.</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold">Leads Meta</h1>
      <p className="mb-5 text-sm text-leaf-800/60">
        Reliez votre compte Facebook / Instagram : les personnes qui remplissent le formulaire de vos
        publicités arrivent directement ici, sans passer par le gestionnaire de publicités.
      </p>

      {info && (
        <p className="mb-4 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-800">{info}</p>
      )}
      {erreur && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      )}

      <div className="space-y-6">
        {/* 1. Application Meta */}
        <section className="card space-y-3">
          <h2 className="font-bold">1. Votre application Meta</h2>
          <p className="text-sm text-leaf-800/70">
            À créer une seule fois sur <b>developers.facebook.com</b> (gratuit), avec le compte
            Facebook qui administre votre page.
          </p>
          <ol className="ml-5 list-decimal space-y-1 text-sm text-leaf-800/80">
            <li>
              <b>Mes applications → Créer une application</b>, type <b>Entreprise</b>.
            </li>
            <li>
              Ajoutez le produit <b>Connexion Facebook</b>, puis dans ses paramètres collez
              l&apos;adresse ci-dessous dans <b>URI de redirection OAuth valides</b>. Sans cela,
              Facebook affiche « URL bloquée » à l&apos;étape 2.
            </li>
            <li>
              Dans <b>Paramètres → Général</b>, copiez l&apos;identifiant et la clé secrète ici, puis
              enregistrez.
            </li>
          </ol>
          <Copiable label="URI de redirection à autoriser" value={s.redirectUri} />
          <div>
            <label className="label" htmlFor="app-id">
              Identifiant de l&apos;application
            </label>
            <input
              id="app-id"
              className="input"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="1234567890123456"
            />
          </div>
          <div>
            <label className="label" htmlFor="app-secret">
              Clé secrète {s.appSecretSet && <span className="text-leaf-700">(enregistrée)</span>}
            </label>
            <input
              id="app-secret"
              className="input"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={s.appSecretSet ? "•••••••• (laisser vide pour conserver)" : "Clé secrète"}
            />
          </div>
          <div>
            <label className="label" htmlFor="pixel-id">
              Identifiant du pixel Meta (mesure des publicités)
            </label>
            <input
              id="pixel-id"
              className="input"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="1234567890"
            />
          </div>
          <button className="btn-primary" onClick={save} disabled={busy}>
            Enregistrer
          </button>
        </section>

        {/* 2. Connexion du compte */}
        <section className="card space-y-3">
          <h2 className="font-bold">2. Connexion de votre compte</h2>
          {s.pageConnected ? (
            <>
              <p className="text-sm">
                ✓ Connecté — page <b>{s.pageName}</b>
                {s.connectedAt && (
                  <span className="text-leaf-800/60">
                    {" "}
                    depuis le {new Date(s.connectedAt).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={importer} disabled={busy}>
                  Importer les prospects existants
                </button>
                <button className="btn-secondary" onClick={loadPages} disabled={busy}>
                  Changer de page
                </button>
                <button className="btn-secondary !text-red-600" onClick={deconnecter}>
                  Déconnecter
                </button>
              </div>
            </>
          ) : s.accountConnected ? (
            <>
              <p className="text-sm">Compte connecté. Choisissez la page qui diffuse vos publicités.</p>
              <button className="btn-secondary" onClick={loadPages} disabled={busy}>
                Voir mes pages
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-leaf-800/70">
                Vous serez redirigé vers Facebook pour autoriser l&apos;accès à vos formulaires
                publicitaires. Aucune publication n&apos;est faite en votre nom.
              </p>
              <a
                className={`btn-primary ${s.appId && s.appSecretSet ? "" : "pointer-events-none opacity-40"}`}
                href="/api/meta/oauth/start"
              >
                Connecter mon compte Meta
              </a>
              {!(s.appId && s.appSecretSet) && (
                <p className="text-xs text-leaf-800/60">
                  Renseignez d&apos;abord l&apos;étape 1.
                </p>
              )}
            </>
          )}

          {pages.length > 0 && (
            <div className="space-y-2 border-t border-leaf-100 pt-3">
              <p className="text-sm font-semibold">Vos pages Facebook</p>
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => choosePage(p.id)}
                  disabled={busy}
                  className="flex w-full items-center justify-between rounded-xl border border-leaf-200 px-4 py-3 text-left text-sm hover:bg-leaf-50"
                >
                  <span>{p.name}</span>
                  <span className="text-xs font-semibold text-leaf-700">
                    {p.id === s.pageId ? "Reliée" : "Relier"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 3. Webhook (à recopier une fois dans Meta) */}
        <section className="card space-y-3">
          <h2 className="font-bold">3. Réception en temps réel</h2>
          <ol className="ml-5 list-decimal space-y-1 text-sm text-leaf-800/80">
            <li>
              Dans votre application, produit <b>Webhooks</b>, choisissez l&apos;objet <b>Page</b>.
            </li>
            <li>Collez les deux valeurs ci-dessous, puis vérifiez et enregistrez.</li>
            <li>
              Abonnez-vous au champ <b>leadgen</b> (bouton « S&apos;abonner » en face de la ligne).
            </li>
            <li>
              Acceptez une fois les <b>conditions Lead Ads</b> sur{" "}
              <span className="font-mono text-xs">facebook.com/ads/leadgen/tos</span> — sans cela
              Facebook refuse de livrer le contenu des formulaires.
            </li>
          </ol>
          <p className="text-sm text-leaf-800/70">
            Sans cette étape, les prospects n&apos;arrivent pas tout seuls : utilisez le bouton
            « Importer les prospects existants ».
          </p>
          <Copiable label="URL de rappel" value={s.webhookUrl} />
          <Copiable label="Jeton de vérification" value={s.verifyToken || "— enregistrez l'étape 1"} />
        </section>

        {/* 4. Prospects reçus */}
        <section className="card">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold">Prospects reçus ({s.leads.length})</h2>
            {s.aTraiter > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {s.aTraiter} à rappeler
              </span>
            )}
          </div>
          {s.leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-leaf-800/60">
              Aucun prospect pour le moment. Ils apparaîtront ici dès votre première publicité.
            </p>
          ) : (
            <div className="space-y-2">
              {s.leads.map((l) => (
                <div
                  key={l.id}
                  className={`rounded-xl border p-3 ${
                    l.handled ? "border-leaf-100 bg-sand-50/60" : "border-leaf-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {l.name}
                        <span className="ml-2 rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-semibold text-leaf-700">
                          {l.source === "meta" ? "Publicité Meta" : "Site"}
                        </span>
                      </p>
                      <p className="text-sm">
                        {l.phone && (
                          <a className="font-medium text-leaf-700 underline" href={`tel:${l.phone}`}>
                            {l.phone}
                          </a>
                        )}
                        {l.email && (
                          <>
                            {l.phone && " · "}
                            <a className="text-leaf-700 underline" href={`mailto:${l.email}`}>
                              {l.email}
                            </a>
                          </>
                        )}
                        {l.postalCode && ` · ${l.postalCode}`}
                      </p>
                    </div>
                    <div className="text-right text-xs text-leaf-800/60">
                      {new Date(l.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {l.message && <p className="mt-2 text-sm text-leaf-800/80">{l.message}</p>}
                  {(l.campaign || l.adName || l.formName) && (
                    <p className="mt-1 text-xs text-leaf-800/50">
                      {[l.campaign, l.adName, l.formName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <button
                    onClick={() => setHandled(l, !l.handled)}
                    className="mt-2 text-xs font-semibold text-leaf-700 underline"
                  >
                    {l.handled ? "Remettre à rappeler" : "Marquer comme rappelé"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

// Rendez-vous : la liste de travail du gérant (RDV à venir, prospects,
// photos, statuts). La vue d'ensemble chiffrée est sur /admin.
import { useEffect, useState } from "react";
import ManualBookingModal from "../ManualBookingModal";
import PhotoUpload from "@/components/PhotoUpload";
import { parseDates } from "@/lib/proStatus";

type Photo = { id: string; dataUrl: string };
type Booking = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  kind: string;
  source: string;
  projectType: string;
  description: string;
  startAt: string | null;
  endAt: string | null;
  status: string;
  proId: string | null;
  pro: { id: string; name: string } | null;
  photosCount: number;
};
type ProLite = {
  id: string;
  name: string;
  basePostalCode: string;
  radiusKm: number;
  datesJson: string;
};

/** Jour de Paris (AAAA-MM-JJ) d'une date ISO. */
function parisDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Libellé de la formule chantier, déduit des heures (fin à 12h = demi-journée). */
function chantierLabel(b: Booking): string {
  if (!b.endAt) return "";
  const endH = new Date(b.endAt).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return endH === "12:00" ? "Demi-journée (8h-12h)" : `Journée entière (8h → ${endH.replace(":", "h")})`;
}
type Lead = { id: string; name: string; phone: string; email: string; postalCode: string; message: string; createdAt: string };

const STATUS_OPTIONS = [
  { id: "a_faire", label: "À faire", color: "bg-amber-100 text-amber-800" },
  { id: "devis_envoye", label: "Devis envoyé", color: "bg-blue-100 text-blue-800" },
  { id: "gagne", label: "Gagné", color: "bg-leaf-100 text-leaf-800" },
  { id: "perdu", label: "Perdu", color: "bg-gray-200 text-gray-700" },
  { id: "annule", label: "Annulé", color: "bg-red-100 text-red-700" },
];

const PROJECT_LABELS: Record<string, string> = {
  entretien: "Entretien de jardin général",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien à l'année",
  autre: "Autre",
};

function fmt(dateIso: string | null): string {
  if (!dateIso) return "Sans date";
  return new Date(dateIso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pros, setPros] = useState<ProLite[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Fiche : édition des notes et photos
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState("");
  // Les photos ne sont plus dans la liste : on les charge à l'ouverture d'une
  // fiche, sinon le tableau de bord téléchargerait toutes les images à chaque
  // ouverture (des dizaines de Mo au bout de quelques mois).
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [photosLoading, setPhotosLoading] = useState<string | null>(null);
  const [tronque, setTronque] = useState(false);

  function load(opts?: { past?: boolean; q?: string }) {
    const past = opts?.past ?? showPast;
    const q = (opts?.q ?? search).trim();
    const params = new URLSearchParams();
    if (past) params.set("past", "1");
    if (q) params.set("q", q);
    fetch(`/api/admin/bookings?${params.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        setBookings(data.bookings ?? []);
        setLeads(data.leads ?? []);
        setPros(data.pros ?? []);
        setTronque(Boolean(data.tronque));
      })
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  // Recherche et historique : nouvelle requête (l'ancienne version filtrait
  // une liste déjà entièrement téléchargée).
  useEffect(() => {
    const t = setTimeout(() => load({ past: showPast, q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPast, search]);

  function openCard(b: Booking) {
    const isOpen = expanded === b.id;
    setExpanded(isOpen ? null : b.id);
    if (!isOpen) {
      setNotesDraft(b.description);
      setNotesSaved(false);
      setNotesError("");
      if (photos[b.id] === undefined) chargerPhotos(b.id);
    }
  }

  async function chargerPhotos(id: string) {
    setPhotosLoading(id);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`);
      const data = res.ok ? await res.json() : { photos: [] };
      setPhotos((p) => ({ ...p, [id]: data.photos ?? [] }));
    } catch {
      setPhotos((p) => ({ ...p, [id]: [] }));
    } finally {
      setPhotosLoading(null);
    }
  }

  async function saveNotes(id: string) {
    setNotesError("");
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: notesDraft }),
    });
    if (res.ok) {
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, description: notesDraft } : b)));
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } else {
      setNotesError("Échec de l'enregistrement, réessayez.");
    }
  }

  async function changePro(id: string, proId: string) {
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proId }),
    });
    if (res.ok) {
      const pro = pros.find((p) => p.id === proId) ?? null;
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, proId: proId || null, pro: pro ? { id: pro.id, name: pro.name } : null } : b
        )
      );
    }
  }

  async function savePhotos(id: string, dataUrls: string[]) {
    // Mise à jour optimiste puis envoi (les data URLs existants sont réutilisables)
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: dataUrls }),
    });
    if (res.ok) {
      const data = await res.json();
      const liste: Photo[] = data.booking.photos ?? [];
      setPhotos((p) => ({ ...p, [id]: liste }));
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, photosCount: liste.length } : b)));
    }
  }

  async function updateStatus(id: string, status: string) {
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status } : b)));
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  // La fenêtre (à venir / historique) et la recherche sont faites par le
  // serveur ; il ne reste ici que le masquage des RDV annulés.
  const visible = bookings.filter((b) => showCancelled || b.status !== "annule");
  visible.sort((a, b) => {
    if (!a.startAt) return -1;
    if (!b.startAt) return 1;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Rendez-vous ({visible.length})</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-leaf-800/70">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
            RDV passés
          </label>
          {tronque && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Liste limitée aux 200 plus proches — affinez la recherche
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-leaf-800/70">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Annulés
          </label>
          <button className="btn-primary !w-auto !px-4 !py-2.5 text-sm" onClick={() => setShowModal(true)}>
            Ajouter un devis manuellement
          </button>
        </div>
      </div>

      <input
        className="input mb-4"
        placeholder="Rechercher un client (nom, téléphone, ville…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}
      {!loading && visible.length === 0 && (
        <p className="card py-8 text-center text-leaf-800/60">
          {search.trim()
            ? "Aucun rendez-vous ne correspond à cette recherche."
            : showPast
              ? "Aucun rendez-vous pour le moment."
              : "Aucun rendez-vous à venir. Cochez « RDV passés » pour voir l'historique."}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((b) => {
          const status = STATUS_OPTIONS.find((s) => s.id === b.status) ?? STATUS_OPTIONS[0];
          const isOpen = expanded === b.id;
          return (
            <div key={b.id} className="card">
              <button
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => openCard(b)}
              >
                <div>
                  <p className="font-semibold">
                    {fmt(b.startAt)}
                    {(b.firstName || b.lastName) ? ` — ${b.firstName} ${b.lastName}`.trimEnd() : " — (sans nom)"}
                  </p>
                  <p className="text-sm text-leaf-800/70">
                    {PROJECT_LABELS[b.projectType] ?? b.projectType}
                    {(b.city || b.postalCode) ? ` · ${b.city || b.postalCode}` : ""}
                  </p>
                  {b.source === "manual" && (
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      Créé manuellement
                    </span>
                  )}
                  {b.kind === "chantier" && b.status !== "annule" && (
                    b.pro ? (
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                        {b.pro.name}
                      </span>
                    ) : (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        À attribuer
                      </span>
                    )
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      b.kind === "chantier"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {b.kind === "chantier" ? "Chantier" : "Devis"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-3 border-t border-leaf-100 pt-4 text-sm">
                  {(b.phone || b.email) && (
                    <p>
                      {b.phone && <a className="text-leaf-700 underline" href={`tel:${b.phone}`}>{b.phone}</a>}
                      {b.phone && b.email && " · "}
                      {b.email && <a className="text-leaf-700 underline" href={`mailto:${b.email}`}>{b.email}</a>}
                    </p>
                  )}
                  {(b.address || b.postalCode || b.city) && (
                    <p>{[b.address, `${b.postalCode} ${b.city}`.trim()].filter(Boolean).join(", ")}</p>
                  )}
                  {b.kind === "chantier" && b.endAt && <p>{chantierLabel(b)}</p>}

                  {b.kind === "chantier" && (
                    <div>
                      <span className="label">Professionnel attribué</span>
                      <select
                        className="input"
                        value={b.proId ?? ""}
                        onChange={(e) => changePro(b.id, e.target.value)}
                      >
                        <option value="">— À attribuer —</option>
                        {pros.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {b.startAt && !parseDates(p.datesJson).includes(parisDay(b.startAt))
                              ? " (n'a pas déclaré ce jour)"
                              : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-leaf-800/50">
                        Attribué automatiquement au plus proche disponible ; changez-le ici si besoin.
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="label">Notes</span>
                    <textarea
                      className="input min-h-[70px]"
                      placeholder="Notes internes sur ce devis…"
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                    />
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => saveNotes(b.id)}
                      >
                        Enregistrer les notes
                      </button>
                      {notesSaved && <span className="text-xs font-semibold text-leaf-700">✓ Enregistré</span>}
                      {notesError && <span className="text-xs font-semibold text-red-600">{notesError}</span>}
                    </div>
                  </div>

                  {photosLoading === b.id && photos[b.id] === undefined ? (
                    <p className="rounded-xl bg-sand-50 px-3 py-2 text-sm text-leaf-800/60">
                      Chargement des {b.photosCount} photo(s)…
                    </p>
                  ) : (
                    <PhotoUpload
                      photos={(photos[b.id] ?? []).map((p) => p.dataUrl)}
                      onChange={(urls) => savePhotos(b.id, urls)}
                      label="Photos (10 max)"
                      maxPhotos={10}
                    />
                  )}
                  <div>
                    <span className="label">Statut</span>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => updateStatus(b.id, s.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            b.status === s.id ? s.color + " ring-2 ring-leaf-600/40" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <ManualBookingModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}

      {leads.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">Demandes hors zone ({leads.length})</h2>
          <div className="space-y-2">
            {leads.map((l) => (
              <div key={l.id} className="card py-3 text-sm">
                <p className="font-semibold">
                  {l.name} — {l.postalCode} · <a className="text-leaf-700 underline" href={`tel:${l.phone}`}>{l.phone}</a>
                </p>
                {l.message && <p className="mt-1 text-leaf-800/70">{l.message}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

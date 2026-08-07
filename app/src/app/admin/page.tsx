"use client";

// Tableau de bord gérant : RDV à venir, détails prospects, photos, statuts.
import { useEffect, useState } from "react";
import ManualBookingModal from "./ManualBookingModal";
import PhotoUpload from "@/components/PhotoUpload";

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
  photos: Photo[];
};

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Fiche : édition des notes et photos
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState("");

  function load() {
    fetch("/api/admin/bookings")
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
      })
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  function openCard(b: Booking) {
    const isOpen = expanded === b.id;
    setExpanded(isOpen ? null : b.id);
    if (!isOpen) {
      setNotesDraft(b.description);
      setNotesSaved(false);
      setNotesError("");
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

  async function savePhotos(id: string, dataUrls: string[]) {
    // Mise à jour optimiste puis envoi (les data URLs existants sont réutilisables)
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: dataUrls }),
    });
    if (res.ok) {
      const data = await res.json();
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, photos: data.booking.photos } : b)));
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

  const now = Date.now();
  // Les devis « sans date » restent toujours visibles, en tête de liste.
  const visible = bookings.filter(
    (b) => !b.startAt || showPast || new Date(b.startAt).getTime() >= now - 24 * 3600_000
  );
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
            Afficher les RDV passés
          </label>
          <button className="btn-primary !w-auto !px-4 !py-2.5 text-sm" onClick={() => setShowModal(true)}>
            Ajouter un devis manuellement
          </button>
        </div>
      </div>

      {loading && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}
      {!loading && visible.length === 0 && (
        <p className="card py-8 text-center text-leaf-800/60">Aucun rendez-vous pour le moment.</p>
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

                  <PhotoUpload
                    photos={b.photos.map((p) => p.dataUrl)}
                    onChange={(urls) => savePhotos(b.id, urls)}
                    label="Photos (10 max)"
                    maxPhotos={10}
                  />
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

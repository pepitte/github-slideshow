"use client";

// Planning patron : agenda partagé, avec les coordonnées (téléphones) visibles.
// Un clic sur une plage libre ouvre la création d'un rendez-vous à cette heure.
import { useState } from "react";
import AgendaView from "@/components/AgendaView";
import ManualBookingModal from "../ManualBookingModal";

export default function PlanningPage() {
  const [creneau, setCreneau] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <AgendaView
        endpoint="/api/admin/planning"
        loginPath="/admin/login"
        showContacts
        refreshToken={refresh}
        onCreneau={(jour, heure) => setCreneau(`${jour}T${heure}`)}
      />
      {creneau && (
        <ManualBookingModal
          defaultDateTime={creneau}
          onClose={() => setCreneau(null)}
          onCreated={() => {
            setCreneau(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </main>
  );
}

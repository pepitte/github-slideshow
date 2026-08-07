"use client";

// Planning patron : agenda partagé, avec les coordonnées (téléphones) visibles.
import AgendaView from "@/components/AgendaView";

export default function PlanningPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <AgendaView endpoint="/api/admin/planning" loginPath="/admin/login" showContacts />
    </main>
  );
}

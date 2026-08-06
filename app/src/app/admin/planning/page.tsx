"use client";

// Planning patron : agenda partagé, avec les coordonnées (téléphones) visibles.
import AdminNav from "../AdminNav";
import AgendaView from "@/components/AgendaView";

export default function PlanningPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <AdminNav />
      <AgendaView endpoint="/api/admin/planning" loginPath="/admin/login" showContacts />
    </main>
  );
}

import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { formatDateFr, formatTimeFr } from "@/lib/dates";
import CancelActions from "./CancelActions";

export const dynamic = "force-dynamic";

export default async function CancelPage({ params }: { params: { token: string } }) {
  const booking = await prisma.booking.findUnique({ where: { cancelToken: params.token } });
  if (!booking) notFound();

  // Chantier multi-jours : récupère tous les jours du groupe.
  const primaryId = booking.groupId || booking.id;
  const group = await prisma.booking.findMany({
    where: { OR: [{ id: primaryId }, { groupId: primaryId }] },
    orderBy: { startAt: "asc" },
    select: { startAt: true },
  });
  const isGroup = group.length > 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-6">
      <SiteHeader />
      <h1 className="mt-4 text-2xl font-extrabold">Modifier ou annuler votre rendez-vous</h1>
      <div className="card mt-5 space-y-1">
        {isGroup ? (
          <>
            <p className="font-semibold">📅 Chantier de {group.length} jours, dès 8h00 :</p>
            <ul className="ml-5 list-disc text-sm text-leaf-900">
              {group.map((g, i) => (
                <li key={i} className="capitalize">{formatDateFr(g.startAt)}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="font-semibold">
            📅 {formatDateFr(booking.startAt)} à {formatTimeFr(booking.startAt)}
          </p>
        )}
        <p className="text-sm text-leaf-800/80">
          📍 {booking.address}, {booking.postalCode} {booking.city}
        </p>
      </div>
      <CancelActions
        token={params.token}
        alreadyCancelled={booking.status === "annule"}
        isGroup={isGroup}
      />
    </main>
  );
}

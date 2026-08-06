import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDateFr, formatTimeFr } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) notFound();
  const settings = await getSettings();
  // Chantier multi-jours : tous les jours du groupe.
  const group = await prisma.booking.findMany({
    where: { OR: [{ id: booking.id }, { groupId: booking.id }] },
    orderBy: { startAt: "asc" },
    select: { startAt: true },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-6 text-center">
      <SiteHeader />
      <span className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-leaf-600 text-3xl text-white">
        ✓
      </span>
      <h1 className="mt-5 text-2xl font-extrabold">Rendez-vous confirmé !</h1>
      <p className="mt-2 text-leaf-800/80">
        Un SMS de confirmation vient de vous être envoyé au {booking.phone}.
      </p>

      <div className="card mt-6 w-full space-y-2 text-left">
        {group.length > 1 ? (
          <>
            <p className="font-semibold">Chantier de {group.length} jours, dès 8h00 :</p>
            <ul className="ml-6 list-disc">
              {group.map((g, i) => (
                <li key={i} className="capitalize">{formatDateFr(g.startAt)}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            <span className="font-semibold">{formatDateFr(booking.startAt)}</span> à{" "}
            <span className="font-semibold">{formatTimeFr(booking.startAt)}</span>
          </p>
        )}
        <p>{booking.address}, {booking.postalCode} {booking.city}</p>
        <p>{settings.companyName} — {settings.companyPhone}</p>
      </div>

      <p className="mt-4 text-sm text-leaf-800/70">
        Vous recevrez un rappel SMS 24 h et 1 h avant le rendez-vous. Un email avec
        l&apos;invitation calendrier (.ics) vous a également été envoyé.
      </p>
      <Link href="/" className="btn-secondary mt-6">← Retour à l&apos;accueil</Link>
    </main>
  );
}

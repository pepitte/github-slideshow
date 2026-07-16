import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { formatDateFr, formatTimeFr } from "@/lib/dates";
import CancelActions from "./CancelActions";

export const dynamic = "force-dynamic";

export default async function CancelPage({ params }: { params: { token: string } }) {
  const booking = await prisma.booking.findUnique({ where: { cancelToken: params.token } });
  if (!booking) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-6">
      <SiteHeader />
      <h1 className="mt-4 text-2xl font-extrabold">Annuler ou reporter</h1>
      <div className="card mt-5 space-y-1">
        <p className="font-semibold">
          📅 {formatDateFr(booking.startAt)} à {formatTimeFr(booking.startAt)}
        </p>
        <p className="text-sm text-leaf-800/80">
          📍 {booking.address}, {booking.postalCode} {booking.city}
        </p>
      </div>
      <CancelActions token={params.token} alreadyCancelled={booking.status === "annule"} />
    </main>
  );
}

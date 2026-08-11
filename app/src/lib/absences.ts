// Absences des professionnels. Une absence est une déclaration explicite
// (« je suis en congés du 1er au 15 ») : elle bloque l'attribution automatique
// et s'affiche dans les agendas, contrairement à un jour non coché qu'on ne
// peut pas distinguer d'un planning pas encore rempli.
import type { Absence } from "@prisma/client";
import { prisma } from "./prisma";

export const MOTIFS_ABSENCE: Record<string, string> = {
  conges: "Congés",
  arret: "Arrêt de travail",
  formation: "Formation",
  personnel: "Personnel",
};

export function estDansAbsence(a: { du: string; au: string }, jour: string): boolean {
  return jour >= a.du && jour <= a.au;
}

/** Jours absents par pro, sur une fenêtre donnée : proId → Set de AAAA-MM-JJ. */
export async function joursAbsents(
  du: string,
  au: string
): Promise<Map<string, Set<string>>> {
  const absences = await prisma.absence.findMany({
    where: { du: { lte: au }, au: { gte: du } },
  });
  const map = new Map<string, Set<string>>();
  for (const a of absences) {
    if (!map.has(a.proId)) map.set(a.proId, new Set());
    const set = map.get(a.proId)!;
    // On n'énumère que les jours de la fenêtre demandée.
    const debut = a.du > du ? a.du : du;
    const fin = a.au < au ? a.au : au;
    const d = new Date(`${debut}T12:00:00Z`);
    const f = new Date(`${fin}T12:00:00Z`);
    while (d <= f) {
      set.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return map;
}

/** Absences d'un pro, les plus récentes d'abord. */
export async function absencesDe(proId: string): Promise<Absence[]> {
  return prisma.absence.findMany({ where: { proId }, orderBy: { du: "desc" } });
}

/** Valide un intervalle saisi par le pro ou le gérant. */
export function validerIntervalle(du: string, au: string): string | null {
  const format = /^\d{4}-\d{2}-\d{2}$/;
  if (!format.test(du) || !format.test(au)) return "Dates invalides.";
  if (au < du) return "La date de fin est avant la date de début.";
  const jours = (new Date(`${au}T00:00:00Z`).getTime() - new Date(`${du}T00:00:00Z`).getTime()) / 86400000;
  if (jours > 366) return "Une absence ne peut pas dépasser un an.";
  return null;
}

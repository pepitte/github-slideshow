// Intégration Google Calendar via l'API REST (OAuth 2.0).
// Toutes les fonctions se dégradent proprement si Google n'est pas connecté :
// l'app fonctionne alors sur la seule base des RDV enregistrés en BDD.
import type { Booking, Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { appUrl } from "./templates";
import { TIMEZONE } from "./dates";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return `${appUrl()}/api/google/callback`;
}

export function authorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Échange OAuth échoué: ${await res.text()}`);
  return res.json();
}

/** Renvoie un access token valide (rafraîchi si besoin), ou null si non connecté. */
async function getAccessToken(settings: Settings): Promise<string | null> {
  if (!googleConfigured() || !settings.googleRefreshToken) return null;
  const stillValid =
    settings.googleAccessToken &&
    settings.googleTokenExpiry &&
    settings.googleTokenExpiry.getTime() > Date.now() + 60_000;
  if (stillValid) return settings.googleAccessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: settings.googleRefreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Rafraîchissement du token Google échoué:", await res.text());
    return null;
  }
  const data = await res.json();
  await prisma.settings.update({
    where: { id: "main" },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return data.access_token;
}

/** Périodes occupées du calendrier Google entre deux instants (freebusy). */
export async function getBusyPeriods(
  settings: Settings,
  timeMin: Date,
  timeMax: Date
): Promise<{ start: Date; end: Date }[]> {
  const token = await getAccessToken(settings);
  if (!token) return [];
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: settings.googleCalendarId || "primary" }],
      }),
    });
    if (!res.ok) {
      console.error("freeBusy Google échoué:", await res.text());
      return [];
    }
    const data = await res.json();
    const calId = settings.googleCalendarId || "primary";
    const calendars: Record<string, { busy?: { start: string; end: string }[] }> =
      data.calendars ?? {};
    const busy = calendars[calId]?.busy ?? Object.values(calendars)[0]?.busy ?? [];
    return busy.map((b: { start: string; end: string }) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
  } catch (e) {
    console.error("freeBusy Google erreur réseau:", e);
    return [];
  }
}

/** Crée l'événement du RDV dans Google Agenda. Renvoie l'ID de l'événement ("" si non connecté). */
export async function createCalendarEvent(settings: Settings, booking: Booking): Promise<string> {
  if (!booking.startAt || !booking.endAt) return ""; // devis manuel sans date
  const token = await getAccessToken(settings);
  if (!token) return "";
  try {
    const calId = encodeURIComponent(settings.googleCalendarId || "primary");
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Devis — ${booking.firstName} ${booking.lastName} (${booking.projectType})`,
          description: `Tél: ${booking.phone}\nEmail: ${booking.email}\nProjet: ${booking.projectType}\n${booking.description}`,
          location: `${booking.address}, ${booking.postalCode} ${booking.city}`,
          start: { dateTime: booking.startAt!.toISOString(), timeZone: TIMEZONE },
          end: { dateTime: booking.endAt!.toISOString(), timeZone: TIMEZONE },
        }),
      }
    );
    if (!res.ok) {
      console.error("Création événement Google échouée:", await res.text());
      return "";
    }
    const data = await res.json();
    return data.id ?? "";
  } catch (e) {
    console.error("Création événement Google erreur réseau:", e);
    return "";
  }
}

/** Supprime l'événement Google lié à un RDV annulé (libère le créneau). */
export async function deleteCalendarEvent(settings: Settings, eventId: string): Promise<void> {
  if (!eventId) return;
  const token = await getAccessToken(settings);
  if (!token) return;
  try {
    const calId = encodeURIComponent(settings.googleCalendarId || "primary");
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error("Suppression événement Google échouée:", e);
  }
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.email ?? "";
  } catch {
    return "";
  }
}

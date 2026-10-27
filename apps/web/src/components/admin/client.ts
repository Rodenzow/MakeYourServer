"use client";

/** Appel d’une route d’administration : renvoie le message d’erreur lisible ou null. */
export async function adminRequest(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `Erreur ${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Le serveur ne répond pas. Vérifiez votre connexion et réessayez." };
  }
}

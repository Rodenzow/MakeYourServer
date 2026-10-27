"use client";

import { useState } from "react";
import {
  EVERYONE,
  PERMISSIONS,
  PERMISSION_GROUP_LABELS,
  isDangerous,
  permissionsForChannelKind,
  type ChannelKind,
  type Overwrite,
  type PermissionGroup,
  type PermissionKey,
  type Role,
} from "@mys/core";
import { colorHex, cx } from "../ui";
import { IconCheck, IconPlus, IconX } from "../icons";

type Tri = "allow" | "neutral" | "deny";

/**
 * Permissions particulières d’un salon ou d’une catégorie (surcharges par rôle).
 * Chaque permission est « autorisée », « héritée » ou « refusée », comme dans Discord.
 */
export function OverwriteEditor({ overwrites, roles, kind, onChange }: { overwrites: Overwrite[]; roles: Role[]; kind: ChannelKind | "category"; onChange: (ows: Overwrite[]) => void }) {
  const targets = overwrites.map((o) => o.target);
  const [active, setActive] = useState<string>(targets[0] ?? EVERYONE);
  const current = overwrites.find((o) => o.target === active);
  const roleName = (id: string) => (id === EVERYONE ? "@everyone" : roles.find((r) => r.id === id)?.name ?? id);
  const perms = permissionsForChannelKind(kind);

  const setPerm = (key: PermissionKey, tri: Tri) => {
    const base = current ?? { target: active, allow: [], deny: [] };
    const next: Overwrite = { target: active, allow: base.allow.filter((p) => p !== key), deny: base.deny.filter((p) => p !== key) };
    if (tri === "allow") next.allow.push(key);
    if (tri === "deny") next.deny.push(key);
    const others = overwrites.filter((o) => o.target !== active);
    onChange(next.allow.length || next.deny.length ? [...others, next] : others);
  };

  const preset = (name: "private" | "readonly" | "public") => {
    let ows = overwrites.filter((o) => o.target !== EVERYONE);
    if (name === "private") ows = [{ target: EVERYONE, allow: [], deny: ["VIEW_CHANNEL"] }, ...ows];
    if (name === "readonly") ows = [{ target: EVERYONE, allow: [], deny: ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS", "SEND_MESSAGES_IN_THREADS"] }, ...ows];
    onChange(ows);
    setActive(EVERYONE);
  };

  const available = roles.filter((r) => !targets.includes(r.id));
  const groups = new Map<PermissionGroup, PermissionKey[]>();
  for (const k of perms) {
    const g = PERMISSIONS[k].group;
    groups.set(g, [...(groups.get(g) ?? []), k]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs font-semibold text-muted">Préréglages :</span>
        <button type="button" className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold hover:bg-light" onClick={() => preset("private")}>
          Privé (masqué à @everyone)
        </button>
        <button type="button" className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold hover:bg-light" onClick={() => preset("readonly")}>
          Lecture seule
        </button>
        <button type="button" className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold hover:bg-light" onClick={() => preset("public")}>
          Public
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[...new Set([EVERYONE, ...targets])].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActive(t)}
            className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", active === t ? "border-edge bg-accent text-on-accent" : "border-line bg-surface hover:border-edge")}
          >
            <span className="size-2 rounded-full" style={{ background: t === EVERYONE ? "#99aab5" : colorHex(roles.find((r) => r.id === t)?.color) }} />
            {roleName(t)}
            {overwrites.find((o) => o.target === t) && <span className="text-[10px] opacity-70">({(overwrites.find((o) => o.target === t)!.allow.length + overwrites.find((o) => o.target === t)!.deny.length)})</span>}
          </button>
        ))}
        {available.length > 0 && (
          <select
            className="rounded-full border border-dashed border-line bg-surface px-2 py-1 text-xs"
            value=""
            onChange={(e) => e.target.value && setActive(e.target.value)}
            aria-label="Ajouter un rôle"
          >
            <option value="">+ Ajouter un rôle…</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto rounded-xl border border-line">
        {[...groups.entries()].map(([g, keys]) => (
          <div key={g}>
            <p className="sticky top-0 z-10 bg-mist px-3 py-1 text-[11px] font-bold tracking-wide text-muted uppercase">{PERMISSION_GROUP_LABELS[g]}</p>
            <ul className="divide-y divide-line/60">
              {keys.map((k) => {
                const tri: Tri = current?.allow.includes(k) ? "allow" : current?.deny.includes(k) ? "deny" : "neutral";
                return (
                  <li key={k} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                    <span>
                      {PERMISSIONS[k].label}
                      {isDangerous(k) && <span className="ml-1.5 rounded bg-warning-soft px-1 text-[10px] font-bold text-warning">sensible</span>}
                    </span>
                    <TriState value={tri} onChange={(v) => setPerm(k, v)} label={PERMISSIONS[k].label} />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function TriState({ value, onChange, label }: { value: Tri; onChange: (v: Tri) => void; label: string }) {
  const btn = (v: Tri, content: React.ReactNode, title: string, activeCls: string) => (
    <button type="button" aria-pressed={value === v} title={title} aria-label={`${label} : ${title}`} onClick={() => onChange(v)} className={cx("flex h-6 w-7 items-center justify-center", value === v ? activeCls : "text-muted hover:bg-mist")}>
      {content}
    </button>
  );
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-line">
      {btn("deny", <IconX size={13} />, "Refusée", "bg-danger text-white")}
      {btn("neutral", <span className="text-xs">/</span>, "Héritée", "bg-mist text-fg")}
      {btn("allow", <IconCheck size={13} />, "Autorisée", "bg-success text-white")}
    </div>
  );
}

/** Permissions générales d’un rôle (ou de @everyone). */
export function RolePermissions({ value, onChange, selfAssignable }: { value: PermissionKey[]; onChange: (v: PermissionKey[]) => void; selfAssignable?: boolean }) {
  const groups = new Map<PermissionGroup, PermissionKey[]>();
  for (const k of Object.keys(PERMISSIONS) as PermissionKey[]) {
    if (k === "ADMINISTRATOR") continue;
    const g = PERMISSIONS[k].group;
    groups.set(g, [...(groups.get(g) ?? []), k]);
  }
  const toggle = (k: PermissionKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...groups.entries()].map(([g, keys]) => (
        <fieldset key={g} className="rounded-xl border border-line p-3">
          <legend className="px-1 text-[11px] font-bold tracking-wide text-muted uppercase">{PERMISSION_GROUP_LABELS[g]}</legend>
          <ul className="space-y-1">
            {keys.map((k) => {
              const blocked = selfAssignable && isDangerous(k);
              return (
                <li key={k}>
                  <label className={cx("flex cursor-pointer items-center gap-2 text-sm", blocked && "opacity-50")}>
                    <input type="checkbox" className="accent-[var(--color-blue)]" checked={value.includes(k)} disabled={blocked && !value.includes(k)} onChange={() => toggle(k)} />
                    {PERMISSIONS[k].label}
                    {isDangerous(k) && <span className="rounded bg-warning-soft px-1 text-[10px] font-bold text-warning">sensible</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <p className="text-xs text-muted md:col-span-2">
        La permission Administrateur n’est pas proposée : elle contourne toutes les protections. Le propriétaire du serveur garde de toute façon tous les droits.
        {selfAssignable && " Les permissions sensibles sont bloquées pour un rôle que les membres peuvent prendre eux-mêmes."}
      </p>
    </div>
  );
}

export { IconPlus };

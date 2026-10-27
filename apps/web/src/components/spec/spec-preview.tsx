"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SIMULATION_SCOPE_NOTE, allChannels, findChannel, simulateAsRoles, type ServerSpec } from "@mys/core";
import { RoleList, ServerTree } from "../server-tree";
import { ChannelIcon, IconLock } from "../icons";
import { cx } from "../ui";
import { MessagePreview, RichText } from "./message-preview";
import { specToTree } from "./spec-tree";

/**
 * Prévisualisation interactive d’un projet : arborescence, « Voir comme ce rôle »,
 * aperçu des messages du salon sélectionné.
 */
export function SpecPreview({ spec, height = 560 }: { spec: ServerSpec; height?: number }) {
  const [asRole, setAsRole] = useState<string | null>(null);
  const firstText = allChannels(spec).find((c) => c.channel.purpose === "welcome" || c.channel.type === "text")?.channel.id ?? null;
  const [selected, setSelected] = useState<string | null>(firstText);
  const tree = useMemo(() => specToTree(spec, asRole === null ? null : asRole === "everyone" ? [] : [asRole]), [spec, asRole]);
  const channel = selected ? findChannel(spec, selected)?.channel : null;
  const messages = spec.messages.filter((m) => m.channelId === selected);
  const access = asRole !== null && selected ? simulateAsRoles(spec, asRole === "everyone" ? [] : [asRole]).get(selected) : null;

  return (
    <div className="overflow-hidden rounded-[18px] border-2 border-night bg-[#313338] shadow-[5px_5px_0_0_var(--color-night)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/30 bg-night px-3 py-2">
        <label className="text-xs font-semibold text-light/70" htmlFor="voir-comme">
          Voir comme
        </label>
        <select id="voir-comme" value={asRole ?? ""} onChange={(e) => setAsRole(e.target.value || null)} className="rounded-md border border-white/15 bg-night-2 px-2 py-1 text-sm text-white">
          <option value="">Vue complète (administration)</option>
          <option value="everyone">@everyone (nouveau membre)</option>
          {spec.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {asRole !== null && <span className="text-[11px] text-light/60">Simulation : salons grisés = invisibles, « lecture » = lecture seule</span>}
      </div>
      <div className="grid md:grid-cols-[260px_1fr]" style={{ minHeight: height }}>
        <div className="max-h-[70vh] overflow-y-auto border-r border-black/30 bg-night-2 md:max-h-none" style={{ maxHeight: height }}>
          <ServerTree name={spec.meta.name} categories={tree} selected={selected} onSelect={setSelected} className="rounded-none" />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2 border-b border-black/30 px-4 py-2.5 text-white">
            {channel && <ChannelIcon type={channel.type} className="text-[#949ba4]" />}
            <span className="font-semibold">{channel?.name ?? "Sélectionnez un salon"}</span>
            {channel?.topic && <span className="hidden truncate border-l border-white/10 pl-2 text-sm text-[#949ba4] md:block">{channel.topic}</span>}
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4" style={{ maxHeight: height - 50 }}>
            <AnimatePresence mode="wait">
              <motion.div key={`${selected}-${asRole}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="space-y-5">
                {access && !access.canView ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center text-[#949ba4]">
                    <IconLock size={28} />
                    <p>Ce rôle ne voit pas ce salon.</p>
                  </div>
                ) : (
                  <>
                    {channel?.type === "forum" && <p className="text-sm text-[#949ba4]">Forum : les membres créent des publications. Tags : {channel.forumTags?.map((t) => `${t.emoji ?? ""} ${t.name}`).join(" · ") || "aucun"}.</p>}
                    {(channel?.type === "voice" || channel?.type === "stage") && <p className="text-sm text-[#949ba4]">Salon vocal{channel.userLimit ? ` (limite : ${channel.userLimit} personnes)` : ""}.</p>}
                    {messages.map((m) => (
                      <MessagePreview key={m.id} message={m} spec={spec} />
                    ))}
                    {channel && messages.length === 0 && channel.type !== "voice" && channel.type !== "stage" && channel.type !== "forum" && (
                      <p className="text-sm text-[#949ba4]">Aucun message préparé dans ce salon : il démarre vide.</p>
                    )}
                    {access && (
                      <p className={cx("rounded-md px-3 py-2 text-xs", access.canSend ? "bg-[#248046]/20 text-[#9fe3bf]" : "bg-white/5 text-[#c4c9ce]")}>
                        {access.canSend ? "Ce rôle peut écrire ici." : "Ce rôle peut lire mais pas écrire ici."}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="border-t border-black/30 bg-night px-4 py-3">
        <p className="text-[11px] leading-snug text-light/55">{SIMULATION_SCOPE_NOTE}</p>
      </div>
    </div>
  );
}

export function RolesOverview({ spec }: { spec: ServerSpec }) {
  return (
    <div className="space-y-3">
      <RoleList roles={spec.roles.map((r) => ({ key: r.id, name: r.name, color: r.color }))} />
      <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
        {spec.roles.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="w-48 shrink-0 font-semibold">{r.name}</span>
            <span className="text-muted">
              {r.description ?? "—"}
              {r.selfAssignable && <span className="ml-2 rounded bg-light/60 px-1.5 text-[11px] font-semibold text-night">au choix des membres</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { RichText };

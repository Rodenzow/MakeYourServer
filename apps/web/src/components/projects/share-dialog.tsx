"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge, Button, Notice, cx } from "../ui";
import { IconCheck, IconUsers } from "../icons";
import { Avatar, ConfirmDialog, Modal, apiCall, fullDate, relativeTime } from "./common";

type Person = { id: string; name: string; username: string; avatarUrl: string | null };
type MembersResponse = {
  role: "owner" | "editor";
  me: string;
  owner: Person | null;
  members: Array<Person & { role: string; addedAt: string }>;
  invites: Array<{ id: string; expiresAt: string; createdAt: string }>;
  maxMembers: number;
};

/**
 * Co-gestion d’un projet : liste des membres, lien d’invitation (propriétaire),
 * retrait d’un membre ou départ du projet.
 */
export function ShareButton({ projectId, projectName, role }: { projectId: string; projectName: string; role: "owner" | "editor" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconUsers size={15} /> {role === "owner" ? "Partager" : "Membres"}
      </Button>
      <ShareDialog open={open} onClose={() => setOpen(false)} projectId={projectId} projectName={projectName} />
    </>
  );
}

export function ShareDialog({ open, onClose, projectId, projectName }: { open: boolean; onClose: () => void; projectId: string; projectName: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "remove" | "leave"; person: Person } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await apiCall<MembersResponse>(`/api/projects/${projectId}/members`));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
    else {
      setLink(null);
      setCopied(false);
      setError(null);
    }
  }, [open, load]);

  async function createLink() {
    setBusy("invite");
    setError(null);
    setCopied(false);
    try {
      const res = await apiCall<{ url: string; expiresAt: string }>(`/api/projects/${projectId}/invites`, { method: "POST", body: {} });
      setLink(res);
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function revokeLinks() {
    setBusy("revoke");
    setError(null);
    try {
      await apiCall(`/api/projects/${projectId}/invites`, { method: "DELETE" });
      setLink(null);
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copie automatique impossible : sélectionnez le lien puis copiez-le (Ctrl+C).");
    }
  }

  async function confirmAction() {
    if (!confirm) return;
    setBusy("member");
    setConfirmError(null);
    try {
      await apiCall(`/api/projects/${projectId}/members`, { method: "DELETE", body: { userId: confirm.person.id } });
      if (confirm.kind === "leave") {
        router.push("/projets");
        router.refresh();
        return;
      }
      setConfirm(null);
      void load();
    } catch (e) {
      setConfirmError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isOwner = data?.role === "owner";
  const full = !!data && data.members.length >= data.maxMembers;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Co-gérer ce projet" description={`Travaillez à plusieurs sur « ${projectName} ».`}>
        {loadError ? (
          <Notice tone="danger" title="Impossible d’afficher les membres">
            {loadError}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Réessayer
            </button>
          </Notice>
        ) : !data ? (
          <div className="space-y-3" aria-busy="true" aria-label="Chargement des membres">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="size-9 animate-pulse rounded-full bg-mist" />
                <span className="h-4 w-40 animate-pulse rounded bg-mist" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <section aria-labelledby="membres-titre">
              <h3 id="membres-titre" className="mb-2 text-sm font-semibold text-muted">
                Membres ({1 + data.members.length})
              </h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {data.owner && (
                  <li className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={data.owner.name} url={data.owner.avatarUrl} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {data.owner.name}
                        {data.owner.id === data.me && <span className="font-normal text-muted"> (vous)</span>}
                      </span>
                      <span className="text-xs text-muted">Propriétaire</span>
                    </span>
                    <Badge tone="night">Propriétaire</Badge>
                  </li>
                )}
                <AnimatePresence initial={false}>
                  {data.members.map((m) => (
                    <motion.li
                      key={m.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduce ? undefined : { opacity: 0, height: 0 }}
                      className="flex items-center gap-3 overflow-hidden px-3 py-2.5"
                    >
                      <Avatar name={m.name} url={m.avatarUrl} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {m.name}
                          {m.id === data.me && <span className="font-normal text-muted"> (vous)</span>}
                        </span>
                        <span className="text-xs text-muted" title={fullDate(m.addedAt)}>
                          Co-gestionnaire · a rejoint {relativeTime(m.addedAt)}
                        </span>
                      </span>
                      {isOwner ? (
                        <Button variant="ghost" size="sm" onClick={() => { setConfirmError(null); setConfirm({ kind: "remove", person: m }); }} aria-label={`Retirer ${m.name} du projet`}>
                          Retirer
                        </Button>
                      ) : m.id === data.me ? (
                        <Button variant="ghost" size="sm" onClick={() => { setConfirmError(null); setConfirm({ kind: "leave", person: m }); }}>
                          Quitter
                        </Button>
                      ) : null}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {data.members.length === 0 && <p className="mt-2 text-sm text-muted">Personne d’autre ne co-gère ce projet pour l’instant.</p>}
            </section>

            {isOwner ? (
              <section aria-labelledby="invitation-titre" className="rounded-xl border border-line bg-night p-4">
                <h3 id="invitation-titre" className="font-semibold">
                  Inviter quelqu’un
                </h3>
                <p className="mt-1 text-sm text-muted">Envoyez ce lien à la personne de votre choix (par message privé). Il est valable 7 jours et ne fonctionne qu’une seule fois.</p>
                <AnimatePresence mode="wait">
                  {link ? (
                    <motion.div key="link" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
                      <label htmlFor="lien-invitation" className="label">
                        Lien d’invitation
                      </label>
                      <div className="flex gap-2">
                        <input id="lien-invitation" className="field min-w-0 flex-1 font-mono text-xs" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
                        <Button onClick={copy} size="md" variant={copied ? "secondary" : "primary"} aria-live="polite">
                          {copied ? (
                            <>
                              <IconCheck size={15} /> Copié !
                            </>
                          ) : (
                            "Copier"
                          )}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs text-muted">Expire le {fullDate(link.expiresAt)}. Pour des raisons de sécurité, ce lien ne sera plus affiché après fermeture.</p>
                    </motion.div>
                  ) : (
                    <motion.div key="cta" initial={false} className="mt-3">
                      <Button onClick={createLink} disabled={busy === "invite" || full}>
                        {busy === "invite" ? "Création…" : "Créer un lien d’invitation"}
                      </Button>
                      {full && <p className="mt-2 text-xs text-warning">Maximum de {data.maxMembers} co-gestionnaires atteint.</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
                {data.invites.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                    <span className="text-muted">
                      {data.invites.length} lien{data.invites.length > 1 ? "s" : ""} encore valable{data.invites.length > 1 ? "s" : ""}
                    </span>
                    <Button variant="ghost" size="sm" onClick={revokeLinks} disabled={busy === "revoke"}>
                      {busy === "revoke" ? "…" : "Désactiver les liens"}
                    </Button>
                  </div>
                )}
              </section>
            ) : (
              <Notice tone="neutral">Seul le propriétaire du projet peut inviter ou retirer des membres.</Notice>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className={cx("rounded-xl border border-line p-4 text-sm text-ink")}>
              <p className="font-semibold text-fg">Ce que peuvent faire les co-gestionnaires</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>modifier le projet, consulter et restaurer l’historique, utiliser l’IA (comptée sur leur propre offre) ;</li>
                <li>le proposer à la bibliothèque et l’installer sur un serveur où ils ont eux-mêmes les droits Discord nécessaires ;</li>
                <li>seul le propriétaire peut supprimer le projet et gérer les membres.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "leave" ? "Quitter ce projet ?" : `Retirer ${confirm?.person.name ?? ""} ?`}
        confirmLabel={confirm?.kind === "leave" ? "Quitter le projet" : "Retirer"}
        tone="danger"
        busy={busy === "member"}
        error={confirmError}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmAction}
      >
        {confirm?.kind === "leave"
          ? "Vous n’aurez plus accès à ce projet. Il n’est pas supprimé : son propriétaire pourra vous réinviter."
          : "Cette personne n’aura plus accès au projet. Rien n’est modifié sur vos serveurs Discord."}
      </ConfirmDialog>
    </>
  );
}

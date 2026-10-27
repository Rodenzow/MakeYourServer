"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { validateSpec, type ServerSpec } from "@mys/core";

export type Selection =
  | { kind: "category"; id: string }
  | { kind: "channel"; id: string }
  | { kind: "role"; id: string }
  | { kind: "message"; id: string }
  | { kind: "panel"; id: "settings" | "automod" | "welcome" | "features" | "everyone" }
  | null;

interface State {
  spec: ServerSpec;
  past: ServerSpec[];
  future: ServerSpec[];
  /** Version enregistrée côté serveur. */
  revision: number;
  dirty: boolean;
}

type Action =
  | { type: "replace"; spec: ServerSpec; label?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved"; revision: number; stillDirty: boolean }
  | { type: "load"; spec: ServerSpec; revision: number };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "replace":
      return { ...s, spec: a.spec, past: [...s.past.slice(-79), s.spec], future: [], dirty: true };
    case "undo":
      if (!s.past.length) return s;
      return { ...s, spec: s.past[s.past.length - 1]!, past: s.past.slice(0, -1), future: [s.spec, ...s.future], dirty: true };
    case "redo":
      if (!s.future.length) return s;
      return { ...s, spec: s.future[0]!, future: s.future.slice(1), past: [...s.past, s.spec], dirty: true };
    case "saved":
      return { ...s, revision: a.revision, dirty: a.stillDirty };
    case "load":
      return { spec: a.spec, revision: a.revision, past: [], future: [], dirty: false };
  }
}

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

/**
 * État de l’éditeur : historique (annuler / rétablir), enregistrement automatique
 * du brouillon et validation en direct à chaque modification.
 */
export function useEditor(projectId: string, initial: ServerSpec, initialRevision: number) {
  const [state, dispatch] = useReducer(reducer, { spec: initial, past: [], future: [], revision: initialRevision, dirty: false });
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  /** Modifie une copie du projet. */
  const edit = useCallback((mutator: (draft: ServerSpec) => void) => {
    const draft = structuredClone(latest.current.spec);
    mutator(draft);
    dispatch({ type: "replace", spec: draft });
  }, []);
  const replace = useCallback((spec: ServerSpec) => dispatch({ type: "replace", spec }), []);

  const save = useCallback(async () => {
    if (saving.current || !latest.current.dirty) return;
    saving.current = true;
    setStatus("saving");
    const snapshot = latest.current;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: snapshot.spec, revision: snapshot.revision }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setStatus("conflict");
        setError(data.error ?? "Le projet a été modifié ailleurs.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Enregistrement impossible.");
      // Si l’utilisateur a continué à modifier pendant l’envoi, on reste « à enregistrer ».
      const stillDirty = latest.current.spec !== snapshot.spec;
      dispatch({ type: "saved", revision: data.revision, stillDirty });
      setStatus(stillDirty ? "dirty" : "saved");
      setError(null);
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    } finally {
      saving.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (!state.dirty || status === "conflict") return;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [state.spec, state.dirty, save, status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  const validation = useMemo(() => validateSpec(state.spec), [state.spec]);

  return {
    spec: state.spec,
    revision: state.revision,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    edit,
    replace,
    load: (spec: ServerSpec, revision: number) => {
      dispatch({ type: "load", spec, revision });
      setStatus("saved");
      setError(null);
    },
    save,
    status,
    error,
    validation,
  };
}

export type Editor = ReturnType<typeof useEditor>;

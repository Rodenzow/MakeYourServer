"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { cx } from "../ui";

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Champ texte qui n’enregistre qu’à la sortie du champ (évite une révision par frappe). */
export function TextInput({ value, onCommit, multiline, rows = 4, maxLength, placeholder, id, mono }: { value: string; onCommit: (v: string) => void; multiline?: boolean; rows?: number; maxLength?: number; placeholder?: string; id?: string; mono?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onCommit(v);
  const cls = cx("field", mono && "font-mono text-sm");
  return (
    <div className="relative">
      {multiline ? (
        <textarea id={id} className={cx(cls, "min-h-[90px] resize-y")} rows={rows} value={v} maxLength={maxLength} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input id={id} className={cls} value={v} maxLength={maxLength} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      )}
      {maxLength && v.length > maxLength * 0.8 && <span className="absolute right-2 bottom-1 font-mono text-[10px] text-muted">{v.length}/{maxLength}</span>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full border-2 transition-colors", checked ? "border-blue bg-blue" : "border-line bg-night")}
      >
        <span className={cx("absolute top-0.5 size-3 rounded-full transition-all", checked ? "left-[18px] bg-night" : "left-0.5 bg-muted")} />
      </button>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, id }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; id?: string }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function NumberInput({ value, onCommit, min, max, id, suffix }: { value: number; onCommit: (v: number) => void; min?: number; max?: number; id?: string; suffix?: string }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        className="field !w-28"
        value={v}
        min={min}
        max={max}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Number(v) || 0));
          setV(String(n));
          if (n !== value) onCommit(n);
        }}
      />
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </div>
  );
}

export const PALETTE = [0xb8d7ff, 0x83a8f3, 0xa7bdff, 0x5865f2, 0x57f287, 0x23875a, 0xfee75c, 0xf2c14e, 0xeb459e, 0xe5534b, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x95a5a6, 0];

export function ColorInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const hex = `#${value.toString(16).padStart(6, "0")}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c === 0 ? "Sans couleur" : `#${c.toString(16).padStart(6, "0")}`}
          aria-label={c === 0 ? "Sans couleur" : `Couleur #${c.toString(16).padStart(6, "0")}`}
          className={cx("size-7 rounded-md border-2 transition-transform hover:scale-110", value === c ? "border-edge" : "border-transparent")}
          style={{ background: c === 0 ? "repeating-linear-gradient(45deg,#fff,#fff 4px,#e8effc 4px,#e8effc 8px)" : `#${c.toString(16).padStart(6, "0")}` }}
        />
      ))}
      <input type="color" value={value === 0 ? "#99aab5" : hex} onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label="Couleur personnalisée" />
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

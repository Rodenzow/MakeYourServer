import { CHANNEL_TOKEN_RE, ROLE_TOKEN_RE, findChannel, type Message, type ServerSpec } from "@mys/core";
import { Fragment, type ReactNode } from "react";
import { colorHex, cx } from "../ui";

/** Rend les jetons {#salon} et {@role} comme des mentions lisibles. */
export function RichText({ text, spec }: { text?: string; spec: ServerSpec }) {
  if (!text) return null;
  const parts: ReactNode[] = [];
  const re = new RegExp(`${CHANNEL_TOKEN_RE.source}|${ROLE_TOKEN_RE.source}|\\{server\\}|\\*\\*([^*]+)\\*\\*|\\[([^\\]]+)\\]\\((https:[^)]+)\\)`, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index));
    if (m[1]) {
      const ch = findChannel(spec, m[1])?.channel;
      parts.push(<span key={i++} className="rounded bg-blue/25 px-1 font-medium text-[#c9d8ff]">#{ch?.name ?? m[1]}</span>);
    } else if (m[2]) {
      const role = spec.roles.find((r) => r.id === m![2]);
      parts.push(
        <span key={i++} className="rounded px-1 font-medium" style={{ background: `${colorHex(role?.color)}33`, color: colorHex(role?.color) === "#99aab5" ? "#c9d8ff" : colorHex(role?.color) }}>
          @{role?.name ?? m[2]}
        </span>,
      );
    } else if (m[0] === "{server}") parts.push(<strong key={i++}>{spec.meta.name}</strong>);
    else if (m[3]) parts.push(<strong key={i++}>{m[3]}</strong>);
    else if (m[4]) parts.push(<span key={i++} className="text-[#8ab4ff] underline">{m[4]}</span>);
    last = re.lastIndex;
  }
  parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, k) =>
        typeof p === "string" ? (
          <Fragment key={`t${k}`}>
            {p.split("\n").map((line, j, arr) => (
              <Fragment key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </Fragment>
            ))}
          </Fragment>
        ) : (
          p
        ),
      )}
    </>
  );
}

const STYLE: Record<string, string> = { primary: "bg-[#5865f2]", secondary: "bg-[#4e5058]", success: "bg-[#248046]", danger: "bg-[#da373c]" };

export function MessagePreview({ message, spec, compact }: { message: Message; spec: ServerSpec; compact?: boolean }) {
  const accent = spec.meta.accentColor ?? 0x83a8f3;
  return (
    <div className="flex gap-3 text-[14px] text-[#dbdee1]">
      <img src="/brand/logo-64.png" alt="" className="mt-0.5 size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold text-white">Make Your Server</span>
          <span className="ml-1.5 rounded bg-[#5865f2] px-1 py-px text-[10px] font-bold text-white">APP</span>
          {message.pin && <span className="ml-2 text-xs text-[#949ba4]">📌 épinglé</span>}
        </p>
        {message.content && (
          <p className="mt-0.5 whitespace-pre-wrap">
            <RichText text={message.content} spec={spec} />
          </p>
        )}
        {message.embeds.map((e, i) => (
          <div key={i} className="mt-1.5 max-w-[520px] rounded border-l-4 bg-[#2b2d31] px-3 py-2.5" style={{ borderColor: colorHex(e.color ?? accent) }}>
            {e.title && (
              <p className="font-semibold text-white">
                <RichText text={e.title} spec={spec} />
              </p>
            )}
            {e.description && (
              <p className={cx("mt-1 text-[13.5px] leading-relaxed", compact && "line-clamp-4")}>
                <RichText text={e.description} spec={spec} />
              </p>
            )}
            {!compact && e.fields.length > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {e.fields.map((f, j) => (
                  <div key={j} className={f.inline ? "" : "sm:col-span-2"}>
                    <p className="text-[13px] font-semibold text-white">
                      <RichText text={f.name} spec={spec} />
                    </p>
                    <p className="text-[13px]">
                      <RichText text={f.value} spec={spec} />
                    </p>
                  </div>
                ))}
              </div>
            )}
            {compact && e.fields.length > 0 && <p className="mt-1 text-xs text-[#949ba4]">+ {e.fields.length} rubrique(s)</p>}
            {e.footer && <p className="mt-2 text-[11.5px] text-[#949ba4]">{e.footer}</p>}
          </div>
        ))}
        {message.buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.buttons.map((b, i) => (
              <span key={i} className={cx("inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium text-white", b.action === "link" ? "bg-[#4e5058]" : STYLE[b.style])}>
                {b.emoji} {b.label}
                {b.action === "link" && " ↗"}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

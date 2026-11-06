import { Fragment, type ReactNode } from "react";
import { cx } from "../ui";

/**
 * Aperçu façon Discord d’un message programmé : rend le Markdown courant de
 * Discord (gras, italique, souligné, barré, code, liens) et les mentions, qui
 * s’affichent mais ne notifient personne (allowed_mentions vide).
 */

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<]+|@everyone|@here|<@!?\d+>|<@&\d+>|<#\d+>)/g;

function Mention({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]" title="Mention affichée sans notification">
      {children}
    </span>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{renderInline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("__")) out.push(<u key={k}>{renderInline(tok.slice(2, -2), k)}</u>);
    else if (tok.startsWith("~~")) out.push(<s key={k}>{renderInline(tok.slice(2, -2), k)}</s>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-[#1e1f22] px-1 py-px font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*") || tok.startsWith("_")) out.push(<em key={k}>{renderInline(tok.slice(1, -1), k)}</em>);
    else if (tok.startsWith("[")) {
      const [, label] = /^\[([^\]]+)\]/.exec(tok)!;
      out.push(<span key={k} className="text-[#00a8fc] hover:underline">{label}</span>);
    } else if (tok.startsWith("http")) out.push(<span key={k} className="break-all text-[#00a8fc]">{tok}</span>);
    else if (tok === "@everyone" || tok === "@here") out.push(<Mention key={k}>{tok}</Mention>);
    else if (tok.startsWith("<@&")) out.push(<Mention key={k}>@rôle</Mention>);
    else if (tok.startsWith("<@")) out.push(<Mention key={k}>@membre</Mention>);
    else if (tok.startsWith("<#")) out.push(<Mention key={k}>#salon</Mention>);
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function DiscordText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={cx("whitespace-pre-wrap break-words", className)}>
      {lines.map((line, n) => {
        const heading = /^(#{1,3}) (.*)$/.exec(line);
        const quote = /^> (.*)$/.exec(line);
        const key = `l${n}`;
        if (heading) {
          const size = heading[1]!.length === 1 ? "text-xl" : heading[1]!.length === 2 ? "text-lg" : "text-base";
          return (
            <p key={key} className={cx("font-bold text-white", size)}>
              {renderInline(heading[2]!, key)}
            </p>
          );
        }
        if (quote)
          return (
            <p key={key} className="border-l-4 border-[#4e5058] pl-2">
              {renderInline(quote[1]!, key)}
            </p>
          );
        return (
          <Fragment key={key}>
            {renderInline(line, key)}
            {n < lines.length - 1 && "\n"}
          </Fragment>
        );
      })}
    </div>
  );
}

export interface ScheduledPreviewProps {
  content: string;
  embedTitle?: string | null;
  embedDescription?: string | null;
  embedColor?: number | null;
  channelName?: string | null;
  /** Libellé de l’horodatage (ex. « ven. 20 nov. à 18:30 »). */
  when?: string | null;
  className?: string;
}

export function ScheduledPreview({ content, embedTitle, embedDescription, embedColor, channelName, when, className }: ScheduledPreviewProps) {
  const hasEmbed = !!(embedTitle?.trim() || embedDescription?.trim());
  const empty = !content.trim() && !hasEmbed;
  return (
    <div className={cx("overflow-hidden rounded-xl border border-[#1e1f22] bg-[#313338] text-[15px] text-[#dbdee1] shadow-lg", className)} aria-label="Aperçu du message dans Discord">
      <div className="flex items-center gap-2 border-b border-[#1e1f22] px-4 py-2.5 text-sm font-semibold text-white">
        <span className="text-lg leading-none text-[#80848e]">#</span>
        {channelName || "salon"}
      </div>
      <div className="flex gap-3 px-4 py-4">
        <img src="/brand/logo-64.png" alt="" className="mt-0.5 size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <span className="font-semibold text-white">Make Your Server</span>
            <span className="rounded bg-[#5865f2] px-1 py-px text-[10px] font-bold text-white">APP</span>
            {when && <span className="text-xs text-[#949ba4]">{when}</span>}
          </p>
          {empty && <p className="mt-1 italic text-[#949ba4]">Votre message apparaîtra ici…</p>}
          {content.trim() && <DiscordText text={content} className="mt-0.5 leading-[1.375]" />}
          {hasEmbed && (
            <div className="mt-1.5 max-w-[520px] rounded border-l-4 bg-[#2b2d31] px-3 py-2.5" style={{ borderColor: embedColor != null ? `#${embedColor.toString(16).padStart(6, "0")}` : "#1e1f22" }}>
              {embedTitle?.trim() && <p className="font-semibold text-white">{renderInline(embedTitle.trim(), "t")}</p>}
              {embedDescription?.trim() && <DiscordText text={embedDescription} className="mt-1 text-[14px] leading-relaxed" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

/** Deliberately not a full markdown library -- AI narratives here are short
 * (a few sentences, maybe a bullet list) and always rendered inside the
 * dark, tightly-typed AI card grammar, so a tiny hand-rolled parser
 * supporting just **bold** and "- " bullet/"1. " numbered lists gives full
 * control over styling without a new dependency or an unstyled markdown
 * library fighting the design system. */

function renderInline(line: string, keyPrefix: string): React.ReactNode[] {
  const parts = line.split(/(\*\*.+?\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-mer-ink-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function isListLine(line: string): boolean {
  return /^\s*([-*]|\d+\.)\s+/.test(line);
}

function stripListMarker(line: string): { ordered: boolean; content: string } {
  const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
  if (orderedMatch) return { ordered: true, content: orderedMatch[1] };
  const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
  return { ordered: false, content: bulletMatch ? bulletMatch[1] : line };
}

export function AiMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, blockIdx) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        if (lines.every(isListLine)) {
          const ordered = stripListMarker(lines[0]).ordered;
          const ListTag = ordered ? "ol" : "ul";
          return (
            <ListTag
              key={blockIdx}
              className={cn(
                "flex flex-col gap-1 pl-4 text-small leading-relaxed text-mer-ink-primary",
                ordered ? "list-decimal" : "list-disc"
              )}
            >
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>{renderInline(stripListMarker(line).content, `${blockIdx}-${lineIdx}`)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={blockIdx} className="text-small leading-relaxed text-mer-ink-primary">
            {lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {renderInline(line, `${blockIdx}-${lineIdx}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

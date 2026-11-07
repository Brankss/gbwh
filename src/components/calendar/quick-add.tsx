"use client";

import { forwardRef, useMemo, useState } from "react";
import { colorOf, durationLabel, findCategory, repeatLabel, whenLabel, type Category } from "@/lib/calendar";
import { parseQuick, parsedToFields } from "@/lib/calendar-parse";
import { Icon } from "../icons";
import type { EventFields } from "./data";

// "palestra domani 18-19:30 #sport" + Invio → fatto. Sotto si vede subito cosa è stato capito.

const EXAMPLES = [
  "palestra domani 18-19:30 #sport",
  "call con Marco lunedì alle 15 per mezz'ora",
  "studio ogni lun e gio dalle 9 alle 11",
  "ricerca prodotti 2h da pianificare #drop",
];

export const QuickAdd = forwardRef<HTMLInputElement, { now: string; categories: Category[]; onAdd: (f: EventFields) => void; onDetails: (f: EventFields) => void }>(
  function QuickAdd({ now, categories, onAdd, onDetails }, ref) {
    const [text, setText] = useState("");
    const [focus, setFocus] = useState(false);
    const parsed = useMemo(() => (text.trim() ? parseQuick(text, now, categories) : null), [text, now, categories]);
    const fields = parsed ? parsedToFields(parsed) : null;
    const newCategory = parsed?.category && !findCategory(categories, parsed.category) ? parsed.category : null;
    const example = EXAMPLES[Math.floor(+now.slice(14, 16) / 15) % EXAMPLES.length];

    const submit = () => {
      if (!fields?.title) return;
      onAdd(fields);
      setText("");
    };

    return (
      <div className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className={`flex h-11 items-center gap-2.5 rounded-xl border bg-[#0b0b0b]/85 pr-1 pl-3.5 transition-[border-color,box-shadow] ${focus ? "border-white/25 shadow-[0_0_0_3px_var(--ring)]" : "border-white/[0.09] hover:border-white/15"}`}
        >
          <Icon name="plus" className="size-4 shrink-0 text-muted" />
          <input
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(e) => e.key === "Escape" && (setText(""), (e.target as HTMLInputElement).blur())}
            placeholder={`Aggiungi al volo… es. "${example}"`}
            aria-label="Aggiungi al volo"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#6a6a6a]"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={500}
          />
          {fields?.title && (
            <>
              <button
                type="button"
                onClick={() => {
                  onDetails(fields);
                  setText("");
                }}
                className="press hidden h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-soft hover:bg-white/[0.06] hover:text-fg sm:block"
              >
                Dettagli
              </button>
              <button type="submit" className="press chrome h-9 shrink-0 rounded-lg px-3.5 text-sm font-semibold">
                Aggiungi
              </button>
            </>
          )}
        </form>

        {/* Anteprima: come verrà salvato */}
        {fields && (
          <div className="animate-rise mt-2 flex flex-wrap items-center gap-1.5 px-1 text-xs">
            {fields.title ? (
              <>
                <span className="font-semibold text-fg">{fields.title}</span>
                <span className="text-muted">·</span>
                <span className="text-soft">{whenLabel(fields)}</span>
                {fields.repeat && <Tag icon="repeat">{repeatLabel(fields.repeat)}</Tag>}
                {"minutes" in fields && fields.minutes && !fields.start && <Tag icon="clock">{durationLabel(fields.minutes)}</Tag>}
                {fields.category && (
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5">
                    <span className="size-1.5 rounded-full" style={{ background: colorOf(categories, findCategory(categories, fields.category)?.id) }} />
                    {findCategory(categories, fields.category)?.name ?? fields.category}
                    {newCategory && <span className="text-muted">(nuova)</span>}
                  </span>
                )}
                <span className="ml-auto hidden text-muted sm:inline">↵ per aggiungere</span>
              </>
            ) : (
              <span className="text-muted">Scrivi anche cosa devi fare, non solo quando.</span>
            )}
          </div>
        )}
      </div>
    );
  },
);

function Tag({ icon, children }: { icon: "repeat" | "clock"; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-soft">
      <Icon name={icon} className="size-3" />
      {children}
    </span>
  );
}

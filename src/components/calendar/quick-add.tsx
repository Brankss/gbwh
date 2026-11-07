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
          className={`matte flex items-center gap-2 rounded-2xl py-1 pr-1 pl-3.5 transition-shadow ${focus ? "shadow-[0_0_0_1px_rgb(255_255_255/0.25),0_10px_30px_-10px_rgb(0_0_0/0.9)]" : ""}`}
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
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#5f5f5f]"
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
                className="press hidden h-8 shrink-0 rounded-xl px-2.5 text-xs font-medium text-[#b4b4b4] hover:bg-white/[0.06] sm:block"
              >
                Dettagli
              </button>
              <button type="submit" className="press chrome h-8 shrink-0 rounded-xl px-3 text-sm font-semibold">
                Aggiungi
              </button>
            </>
          )}
        </form>

        {/* Anteprima: come verrà salvato */}
        {fields && (
          <div className="animate-rise mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs">
            {fields.title ? (
              <>
                <span className="font-semibold text-fg">{fields.title}</span>
                <span className="text-muted">·</span>
                <span className="text-[#c8c8c8]">{whenLabel(fields)}</span>
                {fields.repeat && <Tag icon="repeat">{repeatLabel(fields.repeat)}</Tag>}
                {"minutes" in fields && fields.minutes && !fields.start && <Tag icon="clock">{durationLabel(fields.minutes)}</Tag>}
                {fields.category && (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5">
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
    <span className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[#c8c8c8]">
      <Icon name={icon} className="size-3" />
      {children}
    </span>
  );
}

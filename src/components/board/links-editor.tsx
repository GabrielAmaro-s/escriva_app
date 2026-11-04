"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import { useState } from "react";
import { newId } from "@/domain/board";
import type { TaskLink } from "@/domain/types";

function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function LinksEditor({ links, onChange }: { links: TaskLink[]; onChange: (l: TaskLink[]) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const clean = normalizeUrl(url);
    if (!clean) return setError("Cole um endereço válido, como site.com/pagina.");
    onChange([...links, { id: newId(), url: clean, title: title.trim() || null }]);
    setUrl("");
    setTitle("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {links.length > 0 && (
        <ul className="flex flex-col">
          {links.map((l) => (
            <li key={l.id} className="group flex items-center gap-2 rounded-lg py-1">
              <ExternalLink className="size-4 shrink-0 text-ink-3" />
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate text-base text-accent hover:underline">
                {l.title ?? hostOf(l.url)}
                {l.title && <span className="ml-2 text-xs text-ink-3">{hostOf(l.url)}</span>}
              </a>
              <button
                type="button"
                aria-label={`Remover ${l.title ?? l.url}`}
                onClick={() => onChange(links.filter((x) => x.id !== l.id))}
                className="grid size-6 place-items-center rounded text-ink-3 opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Endereço do link"
          aria-label="Endereço do link"
          inputMode="url"
          className="h-8 min-w-0 flex-[3] rounded-md border border-line bg-surface px-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Nome (opcional)"
          aria-label="Nome do link"
          className="h-8 min-w-0 flex-[2] rounded-md border border-line bg-surface px-2 text-sm placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!url.trim()}
          className="flex h-8 items-center justify-center gap-1 rounded-md border border-line px-2.5 text-sm hover:bg-surface-2 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Adicionar
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

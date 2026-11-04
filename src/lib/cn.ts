import { twMerge } from "tailwind-merge";

/** Junta classes e resolve conflitos do Tailwind (a última vence). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(" "));
}

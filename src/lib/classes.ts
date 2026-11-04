import { twMerge } from "tailwind-merge";

/** Junta classes e resolve conflitos do Tailwind (a última vence). */
export function classes(...partes: (string | false | null | undefined)[]): string {
  return twMerge(partes.filter(Boolean).join(" "));
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { classes } from "@/lib/classes";

type Variante = "primaria" | "secundaria" | "discreta";
type Tamanho = "md" | "sm" | "icone" | "icone-sm";

const variantes: Record<Variante, string> = {
  primaria: "border-0 bg-primary text-on-primary font-semibold hover:brightness-110",
  secundaria: "border border-line-forte bg-surface-raised text-ink font-medium hover:bg-hover",
  discreta: "border-0 bg-transparent text-ink-muted hover:bg-hover hover:text-ink",
};

const tamanhos: Record<Tamanho, string> = {
  md: "h-[38px] gap-2 rounded-[10px] px-4 text-[13.5px]",
  sm: "h-[34px] gap-1.5 rounded-[9px] px-3.5 text-[13px]",
  icone: "size-[38px] rounded-[10px]",
  "icone-sm": "size-[30px] rounded-lg",
};

export interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
}

export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante = "secundaria", tamanho = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background,color,filter,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50",
        variantes[variante],
        tamanhos[tamanho],
        className,
      )}
      {...props}
    />
  );
});

export const BotaoIcone = forwardRef<HTMLButtonElement, PropsBotao & { rotulo: string }>(function BotaoIcone(
  { rotulo, variante = "discreta", tamanho = "icone-sm", ...props },
  ref,
) {
  return <Botao ref={ref} variante={variante} tamanho={tamanho} aria-label={rotulo} title={rotulo} {...props} />;
});

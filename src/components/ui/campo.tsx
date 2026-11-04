import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { classes } from "@/lib/classes";

export const classeControle =
  "w-full rounded-[10px] border border-line2 bg-surface px-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink3 focus:border-primary focus:shadow-focus";

export const CampoTexto = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function CampoTexto({ className, ...props }, ref) {
  return <input ref={ref} className={classes(classeControle, "h-[38px]", className)} {...props} />;
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto({ className, ...props }, ref) {
  return <textarea ref={ref} className={classes(classeControle, "py-2.5 leading-normal", className)} {...props} />;
});

/** Select nativo com ícone opcional à esquerda e seta à direita, como no design. */
export function Selecao({ inicio, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { inicio?: ReactNode }) {
  return (
    <div className="relative">
      {inicio && <span className="pointer-events-none absolute inset-y-0 left-[11px] flex items-center">{inicio}</span>}
      <select
        className={classes(classeControle, "h-9 cursor-pointer appearance-none rounded-[9px] pr-[30px] text-[13px]", inicio ? "pl-[30px]" : "pl-3", className)}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-ink3">
        <CaretDownIcon size={14} />
      </span>
    </div>
  );
}

export function RotuloCampo({ children, obrigatorio, htmlFor }: { children: ReactNode; obrigatorio?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold">
      {children}
      {obrigatorio && (
        <span className="text-s-red" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}

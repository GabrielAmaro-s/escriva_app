import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export const controlClass =
  "w-full rounded-[10px] border border-line2 bg-surface px-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink3 focus:border-primary focus:shadow-focus";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClass, "h-[38px]", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(controlClass, "py-2.5 leading-normal", className)} {...props} />;
});

/** Select nativo com ícone opcional à esquerda e seta à direita, como no design. */
export function Select({
  leading,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { leading?: ReactNode }) {
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-[11px] flex items-center">{leading}</span>}
      <select
        className={cn(
          controlClass,
          "h-9 cursor-pointer appearance-none rounded-[9px] pr-[30px] text-[13px]",
          leading ? "pl-[30px]" : "pl-3",
          className,
        )}
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

export function FieldLabel({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold">
      {children}
      {required && (
        <span className="text-s-red" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}

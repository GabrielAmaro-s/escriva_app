import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
  "danger-ghost": "text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-sm gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "size-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-[background,color,border,filter] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, className, variant = "ghost", ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    />
  );
});

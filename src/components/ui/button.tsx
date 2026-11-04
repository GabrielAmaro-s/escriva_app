import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary: "border-0 bg-primary text-on-primary font-semibold hover:brightness-110",
  secondary: "border border-line2 bg-surface text-ink font-medium hover:bg-hover",
  ghost: "border-0 bg-transparent text-ink2 hover:bg-hover hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-[38px] gap-2 rounded-[10px] px-4 text-[13.5px]",
  sm: "h-[34px] gap-1.5 rounded-[9px] px-3.5 text-[13px]",
  icon: "size-[38px] rounded-[10px]",
  "icon-sm": "size-[30px] rounded-lg",
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
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[background,color,filter,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, variant = "ghost", size = "icon-sm", ...props },
  ref,
) {
  return <Button ref={ref} variant={variant} size={size} aria-label={label} title={label} {...props} />;
});

import { cva, type VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";
import type { ComponentProps } from "react";

const buttonVariants = cva("button", {
  variants: { variant: { primary: "primary", outline: "outline", danger: "danger" } },
  defaultVariants: { variant: "primary" },
});

export function Button({ variant, className, ...props }: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={twMerge(buttonVariants({ variant }), className)} {...props} />;
}

"use client";

import { separator, type SeparatorProps } from "@tailus/themer";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import React from "react";

interface SeparatorVariantProps
  extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>,
    Pick<SeparatorProps, "fancy" | "dashed"> {}

export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  SeparatorVariantProps
>(({ fancy, dashed, className, orientation = "horizontal", ...props }, ref) => {
  if (fancy && dashed) {
    throw new Error("A separator cannot be both fancy and dashed");
  }

  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={separator({ fancy, dashed, orientation, className })}
      {...props}
      ref={ref}
    />
  );
});

Separator.displayName = "TailusSeparator";
export default Separator;

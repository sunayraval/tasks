"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import React from "react";
import { popover, type PopoverProps } from "@tailus/themer";
import { cn } from "@/utils/cn";

export const PopoverRoot = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverPortal = PopoverPrimitive.Portal;

export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & PopoverProps
>(({ className, fancy, mixed = true, ...props }, forwardedRef) => {
  const { content } = popover();
  if (fancy && mixed) {
    mixed = false;
  }

  return (
    <PopoverPrimitive.Content
      {...props}
      ref={forwardedRef}
      className={cn("z-50", content({ fancy, mixed, className }))}
    />
  );
});

export const PopoverArrow = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow>
>(({ className, ...props }, forwardedRef) => {
  const { arrow } = popover();
  return (
    <PopoverPrimitive.Arrow
      {...props}
      ref={forwardedRef}
      className={arrow({ className })}
    />
  );
});

PopoverContent.displayName = "TailusPopoverContent";

export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Anchor: PopoverAnchor,
  Portal: PopoverPortal,
  Content: PopoverContent,
  Arrow: PopoverArrow,
  Close: PopoverPrimitive.Close,
};

export default Popover;

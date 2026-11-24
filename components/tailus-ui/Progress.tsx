"use client";

import React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import {
  progress,
  type RootProps,
  type IndicatorProps as IndicatorVariants,
} from "@tailus/themer";

const { root, indicator } = progress();

export const ProgressRoot = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & RootProps
>(({ className, size = "md", variant = "soft", style, ...props }, forwardedRef) => {
  return (
    <ProgressPrimitive.Root
      {...props}
      ref={forwardedRef}
      className={root({ size, variant, className })}
      style={{
        transform: "translateZ(0)",
        ...style,
      }}
    />
  );
});

export interface ProgressIndicatorProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Indicator>,
    IndicatorVariants {}

export const ProgressIndicator = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Indicator>,
  ProgressIndicatorProps
>(
  (
    {
      className,
      intent = "primary",
      indeterminate = "gray",
      withHighlight = false,
      innerShadow = false,
      loading = "primary",
      complete = "success",
      withStripes = false,
      ...props
    },
    forwardedRef
  ) => {
    if (withHighlight && withStripes) {
      throw new Error(
        "The highlight and stripes styles cannot be applied together!"
      );
    }

    return (
      <ProgressPrimitive.Indicator
        {...props}
        ref={forwardedRef}
        className={indicator({
          intent,
          indeterminate,
          complete,
          withStripes,
          loading,
          withHighlight,
          innerShadow,
          className,
        })}
      />
    );
  }
);

ProgressRoot.displayName = "TailusProgressRoot";
ProgressIndicator.displayName = "TailusProgressIndicator";

export const Progress = {
  Root: ProgressRoot,
  Indicator: ProgressIndicator,
};

export default Progress;

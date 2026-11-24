"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import React from "react";
import {
  tabs,
  type TabsListProps as ListProps,
  type TabsIndicatorProps as IndicatorProps,
} from "@tailus/themer";

const { list, trigger, indicator } = tabs();

const TabsContext = React.createContext<Omit<ListProps, "variant">>({
  intent: "primary",
  size: "md",
  triggerVariant: "plain",
});

export const TabsRoot = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & ListProps
>(
  (
    {
      className,
      variant = "soft",
      triggerVariant = "softToSoft",
      intent = "primary",
      size = "md",
      ...props
    },
    forwardedRef
  ) => {
    const resolvedVariant = variant || "soft";

    return (
      <TabsContext.Provider value={{ triggerVariant, intent, size }}>
        <TabsPrimitive.List
          {...props}
          ref={forwardedRef}
          className={list({
            listVariant: resolvedVariant,
            size,
            triggerVariant,
            className,
          })}
        />
      </TabsContext.Provider>
    );
  }
);

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    Partial<Pick<ListProps, "triggerVariant" | "intent" | "size">>
>(({ className, triggerVariant: propTriggerVariant, size: propSize, intent: propIntent, ...props }, forwardedRef) => {
  const ctx = React.useContext(TabsContext);
  const triggerVariant = propTriggerVariant ?? ctx.triggerVariant;
  const size = propSize ?? ctx.size;
  const intent = propIntent ?? ctx.intent;

  return (
    <TabsPrimitive.Trigger
      {...props}
      ref={forwardedRef}
      className={trigger({ triggerVariant, size, intent, className })}
    />
  );
});

export const TabsIndicator = React.forwardRef<
  React.ComponentRef<"span">,
  React.ComponentPropsWithoutRef<"span"> & Pick<IndicatorProps, "variant">
>(({ className, variant = "elevated", ...props }, forwardedRef) => {
  const { intent } = React.useContext(TabsContext);

  return (
    <span
      {...props}
      aria-hidden
      ref={forwardedRef}
      className={indicator({ indicatorVariant: variant, intent, className })}
    />
  );
});

export const TabsContent = TabsPrimitive.Content;

TabsList.displayName = "TailusTabsList";
TabsTrigger.displayName = "TailusTabsTrigger";
TabsIndicator.displayName = "TailusTabsIndicator";

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
  Indicator: TabsIndicator,
};

export default Tabs;

"use client";

import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cloneElement, cn } from "@/utils/cn";
import {
  caption,
  select,
  trigger,
  type SelectProps,
  type TriggerProps,
  type SeparatorProps,
} from "@tailus/themer";

interface SelectIconProps {
  className?: string;
  children: React.ReactNode;
  size?: TriggerProps["size"];
}

const SelectContext = React.createContext<SelectProps>({});
const { button, separator, itemIndicator, label } = select.soft();

export const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, children, ...props }, forwardedRef) => (
  <SelectPrimitive.ScrollUpButton
    {...props}
    ref={forwardedRef}
    className={button({ className })}
  >
    {children || <ChevronUp className="size-3.5" />}
  </SelectPrimitive.ScrollUpButton>
));

export const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, children, ...props }, forwardedRef) => (
  <SelectPrimitive.ScrollDownButton
    {...props}
    ref={forwardedRef}
    className={button({ className })}
  >
    {children || <ChevronDown className="size-3.5" />}
  </SelectPrimitive.ScrollDownButton>
));

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & TriggerProps
>(({ size, variant, className, children, ...props }, forwardedRef) => {
  const { parent } = trigger();
  return (
    <SelectPrimitive.Trigger
      {...props}
      ref={forwardedRef}
      className={parent({ size, variant, className })}
    >
      {children}
    </SelectPrimitive.Trigger>
  );
});

export const SelectTriggerIcon = ({
  className,
  size,
  children,
}: SelectIconProps) => {
  const { icon } = trigger();
  return cloneElement(children as React.ReactElement, icon({ size, className }));
};

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & SelectProps
>(
  (
    {
      className,
      variant,
      intent,
      mixed,
      fancy,
      children,
      position = "popper",
      ...props
    },
    forwardedRef
  ) => {
    const {
      variant: contextVariant,
      intent: contextIntent,
      fancy: contextFancy,
    } = React.useContext(SelectContext);

    const resolvedVariant = variant || contextVariant || "soft";
    const resolvedIntent = intent || contextIntent;
    const resolvedFancy = fancy || contextFancy;

    if (resolvedFancy && mixed) {
      mixed = false;
    }

    const { content } = select[resolvedVariant]();

    return (
      <SelectContext.Provider
        value={{
          variant: resolvedVariant,
          fancy: resolvedFancy,
          intent: resolvedIntent,
        }}
      >
        <SelectPrimitive.Content
          position={position}
          {...props}
          ref={forwardedRef}
          className={cn(
            "z-50",
            content({
              mixed,
              fancy: resolvedFancy,
              intent: resolvedIntent,
              className,
            })
          )}
        >
          {children}
        </SelectPrimitive.Content>
      </SelectContext.Provider>
    );
  }
);

export const SelectItemIndicator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ItemIndicator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ItemIndicator>
>(({ className, ...props }, forwardedRef) => (
  <SelectPrimitive.ItemIndicator
    {...props}
    ref={forwardedRef}
    className={itemIndicator({ className })}
  />
));

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & SelectProps
>(({ className, variant, children, ...props }, forwardedRef) => {
  const { variant: contextVariant, intent } = React.useContext(SelectContext);
  const resolvedVariant = variant || contextVariant || "soft";
  const { item } = select[resolvedVariant]();

  return (
    <SelectPrimitive.Item
      {...props}
      ref={forwardedRef}
      className={item({ intent, className })}
    >
      {children}
    </SelectPrimitive.Item>
  );
});

export const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, forwardedRef) => (
  <SelectPrimitive.Label
    {...props}
    ref={forwardedRef}
    className={cn(caption(), label(), className)}
  />
));

export const SelectGroup = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>
>(({ children, ...props }, forwardedRef) => (
  <SelectPrimitive.Group {...props} ref={forwardedRef}>
    {children}
  </SelectPrimitive.Group>
));

export const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator> &
    Pick<SeparatorProps, "fancy" | "dashed">
>(({ className, fancy, dashed, ...props }, forwardedRef) => {
  const { fancy: contextFancy } = React.useContext(SelectContext);
  const resolvedFancy = fancy || contextFancy;
  return (
    <SelectPrimitive.Separator
      {...props}
      ref={forwardedRef}
      className={separator({ fancy: resolvedFancy, dashed, className })}
    />
  );
});

SelectTrigger.displayName = "TailusSelectTrigger";
SelectContent.displayName = "TailusSelectContent";
SelectItem.displayName = "TailusSelectItem";

export const Select = {
  Root: SelectPrimitive.Root,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Item: SelectItem,
  Group: SelectGroup,
  Separator: SelectSeparator,
  Portal: SelectPrimitive.Portal,
  Value: SelectPrimitive.Value,
  Icon: SelectPrimitive.Icon,
  ItemIndicator: SelectItemIndicator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
  Label: SelectLabel,
  Viewport: SelectPrimitive.Viewport,
  ItemText: SelectPrimitive.ItemText,
  TriggerIcon: SelectTriggerIcon,
};

export default Select;

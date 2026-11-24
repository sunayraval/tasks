"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import React from "react";
import { cloneElement, cn } from "@/utils/cn";
import {
  menu,
  menuSeparator as separator,
  defaultMenuProps,
  type MenuProps,
  type MenuSeparatorProps as SeparatorProps,
} from "@tailus/themer";

export const DropdownMenuRoot = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuLabel = DropdownMenuPrimitive.Label;
export const DropdownMenuCheckboxItem = DropdownMenuPrimitive.CheckboxItem;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
export const DropdownMenuRadioItem = DropdownMenuPrimitive.RadioItem;
export const DropdownMenuItemIndicator = DropdownMenuPrimitive.ItemIndicator;
export const DropdownMenuArrow = DropdownMenuPrimitive.Arrow;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const MenuContext = React.createContext<MenuProps>(defaultMenuProps);

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & MenuProps
>(({ className, variant, intent, mixed, fancy, ...props }, forwardedRef) => {
  const {
    variant: contextVariant,
    intent: contextIntent,
    mixed: contextMixed,
    fancy: contextFancy,
  } = React.useContext(MenuContext);

  const resolvedVariant = variant || contextVariant || "soft";
  const resolvedIntent = intent || contextIntent;
  const resolvedFancy = fancy ?? contextFancy;
  let resolvedMixed = mixed ?? contextMixed;

  if (resolvedFancy && resolvedMixed) {
    resolvedMixed = false;
  }

  const contextValues: MenuProps = {
    variant: resolvedVariant,
    intent: resolvedIntent,
    fancy: resolvedFancy,
    mixed: resolvedMixed,
  };
  const { content } = menu[resolvedVariant]();

  return (
    <MenuContext.Provider value={contextValues}>
      <DropdownMenuPrimitive.Content
        {...props}
        ref={forwardedRef}
        className={cn(
          "z-50",
          content({
            mixed: resolvedMixed,
            fancy: resolvedFancy,
            intent: resolvedIntent,
            className,
          })
        )}
      />
    </MenuContext.Provider>
  );
});

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & MenuProps
>(({ className, variant, intent, ...props }, forwardedRef) => {
  const contextValues = React.useContext(MenuContext);
  const resolvedVariant = variant || contextValues.variant || "soft";
  const resolvedIntent = intent || contextValues.intent;

  const { item } = menu[resolvedVariant]({ intent: resolvedIntent });

  return (
    <DropdownMenuPrimitive.Item
      {...props}
      ref={forwardedRef}
      className={item({ intent: resolvedIntent, className })}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator> &
    SeparatorProps
>(({ className, fancy, dashed, ...props }, forwardedRef) => {
  const { fancy: contextVariant } = React.useContext(MenuContext);
  const resolvedFancy = fancy || contextVariant;

  return (
    <DropdownMenuPrimitive.Separator
      {...props}
      ref={forwardedRef}
      className={separator({ fancy: resolvedFancy, dashed, className })}
    />
  );
});

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> &
    MenuProps
>(({ className, variant, intent, ...props }, forwardedRef) => {
  const contextValues = React.useContext(MenuContext);
  const resolvedVariant = variant || contextValues.variant || "soft";
  const resolvedIntent = intent || contextValues.intent;

  const { subTrigger } = menu[resolvedVariant]({});

  return (
    <DropdownMenuPrimitive.SubTrigger
      {...props}
      ref={forwardedRef}
      className={subTrigger({ intent: resolvedIntent, className })}
    />
  );
});

export const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> &
    MenuProps
>(({ className, variant, intent, fancy, mixed, ...props }, forwardedRef) => {
  const {
    variant: contextVariant,
    intent: contextIntent,
    fancy: contextFancy,
    mixed: contextMixed,
  } = React.useContext(MenuContext);

  const resolvedVariant = variant || contextVariant || "soft";
  const resolvedIntent = intent || contextIntent;
  const resolvedFancy = fancy || contextFancy;
  const resolvedMixed = resolvedFancy ? false : mixed || contextMixed;
  const { content } = menu[resolvedVariant]({ intent: resolvedIntent });

  return (
    <DropdownMenuPrimitive.SubContent
      {...props}
      ref={forwardedRef}
      className={cn(
        "z-50",
        content({
          mixed: resolvedMixed,
          fancy: resolvedFancy,
          intent: resolvedIntent,
          className,
        })
      )}
    />
  );
});

interface DropdownMenuIconProps extends MenuProps {
  className?: string;
  children?: React.ReactNode;
}

export const DropdownMenuIcon = ({
  className,
  children,
}: DropdownMenuIconProps) => {
  const { icon } = menu.soft({});
  if (!React.isValidElement(children)) return <>{children}</>;
  return cloneElement(children, icon({ className }));
};

export const DropdownMenuRightIcon = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & MenuProps
>(({ className, ...props }, forwardedRef) => {
  const { icon } = menu.solid({});
  return <div {...props} ref={forwardedRef} className={icon({ className })} />;
});

DropdownMenuContent.displayName = "TailusDropdownMenuContent";
DropdownMenuItem.displayName = "TailusDropdownMenuItem";

export const DropdownMenu = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Portal: DropdownMenuPortal,
  Content: DropdownMenuContent,
  Arrow: DropdownMenuArrow,
  Item: DropdownMenuItem,
  Group: DropdownMenuGroup,
  Label: DropdownMenuLabel,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  ItemIndicator: DropdownMenuItemIndicator,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Icon: DropdownMenuIcon,
  RightIcon: DropdownMenuRightIcon,
};

export default DropdownMenu;

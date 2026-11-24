"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from "react";
import Button from "./Button";
import { cn } from "@/utils/cn";
import {
  dialog,
  title,
  text,
  type DialogProps,
  type TitleSizeProp,
  type TextProps,
  type TextSizeProp,
  type TextAlignProp,
  type TextWeightProp,
} from "@tailus/themer";

export const DialogRoot = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, forwardedRef) => {
  const { overlay } = dialog();

  return (
    <DialogPrimitive.Overlay
      {...props}
      ref={forwardedRef}
      className={cn("z-50 backdrop-blur-sm", overlay({ className }))}
    />
  );
});

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & DialogProps
>(({ className, fancy, mixed = true, ...props }, forwardedRef) => {
  const { content } = dialog();

  if (fancy && mixed) {
    mixed = false;
  }

  return (
    <DialogPrimitive.Content
      {...props}
      ref={forwardedRef}
      className={cn("z-50", content({ fancy, mixed, className }))}
    />
  );
});

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    size?: TitleSizeProp;
    align?: TextAlignProp;
    weight?: TextWeightProp;
  }
>(
  (
    { className, size = "base", align, weight = "semibold", ...props },
    forwardedRef
  ) => (
    <DialogPrimitive.Title
      {...props}
      ref={forwardedRef}
      className={title({
        size,
        align,
        weight,
        className,
      })}
    />
  )
);

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> &
    TextProps & {
      size?: TextSizeProp;
      align?: TextAlignProp;
      weight?: TextWeightProp;
    }
>(({ className, size = "sm", weight, align, neutral, ...props }, forwardedRef) => (
  <DialogPrimitive.Description
    {...props}
    ref={forwardedRef}
    className={text({
      size,
      weight,
      align,
      neutral,
      className,
    })}
  />
));

export const DialogActions = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, forwardedRef) => {
  const { actions } = dialog();
  return (
    <div {...props} ref={forwardedRef} className={actions({ className })} />
  );
});

type DialogCloseButtonProps = React.ComponentProps<typeof Button.Root>;

export const DialogCloseButton: React.FC<DialogCloseButtonProps> = ({
  className,
  children,
  ...props
}) => {
  const { close } = dialog();

  return (
    <Button.Root
      {...props}
      className={close({ className })}
      variant="ghost"
      intent="gray"
      size="sm"
    >
      <Button.Icon type="only" size="xs">
        {children}
      </Button.Icon>
    </Button.Root>
  );
};

DialogOverlay.displayName = "TailusDialogOverlay";
DialogContent.displayName = "TailusDialogContent";
DialogTitle.displayName = "TailusDialogTitle";
DialogDescription.displayName = "TailusDialogDescription";
DialogActions.displayName = "TailusDialogActions";

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Actions: DialogActions,
  CloseButton: DialogCloseButton,
  Close: DialogClose,
};

export default Dialog;

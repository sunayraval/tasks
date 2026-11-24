"use client";

import React from "react";
import { cloneElement } from "@/utils/cn";
import {
  button,
  buttonIcon as icon,
  type ButtonProps as ButtonVariantsProps,
  type ButtonIconProps,
} from "@tailus/themer";

export type Root = typeof Root;
export type Icon = typeof Icon;
export type Label = typeof Label;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantsProps {
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export interface IconProps
  extends React.HTMLAttributes<HTMLElement>,
    ButtonIconProps {}

export const Icon: React.FC<IconProps> = ({
  className,
  children,
  size = "md",
  type = "leading",
}) => {
  return (
    <>
      {React.isValidElement(children)
        ? cloneElement(children, icon({ size, type, className }))
        : children}
    </>
  );
};

export const Label = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, forwardedRef) => {
  return (
    <span className={className} {...props} ref={forwardedRef}>
      {children}
    </span>
  );
});

export const Root = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(
  (
    {
      className,
      intent = "primary",
      variant = "solid",
      size = "md",
      disabled,
      href,
      type = "button",
      children,
      ...props
    },
    forwardedRef
  ) => {
    const iconOnly = React.Children.toArray(children).some(
      (child) =>
        React.isValidElement(child) &&
        child.type === Icon &&
        (child.props as IconProps).type === "only"
    );
    const buttonSize = iconOnly ? "iconOnlyButtonSize" : "size";
    const resolvedClassName = button[variant as keyof typeof button]({
      intent,
      [buttonSize]: size,
      className,
    });

    if (href) {
      return (
        <a
          ref={forwardedRef as React.ForwardedRef<HTMLAnchorElement>}
          href={href}
          className={resolvedClassName}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        ref={forwardedRef as React.ForwardedRef<HTMLButtonElement>}
        type={type}
        className={resolvedClassName}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Root.displayName = "TailusButtonRoot";
Icon.displayName = "TailusButtonIcon";
Label.displayName = "TailusButtonLabel";

export const Button = {
  Root,
  Icon,
  Label,
};

export default Button;

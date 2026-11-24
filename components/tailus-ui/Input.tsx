"use client";

import React, { useContext } from "react";
import {
  form,
  type FormProps,
  type InputProps as InputVariants,
  type LabelProps,
  type MessageProps,
} from "@tailus/themer";

export interface FormContextValue extends FormProps {
  fancy?: boolean;
}

export const FormContext = React.createContext<FormContextValue>({
  variant: "outlined",
  size: "md",
  floating: false,
  fancy: false,
});

export const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & FormContextValue
>(
  (
    {
      className,
      variant = "outlined",
      size = "md",
      floating = false,
      fancy = false,
      children,
      ...props
    },
    ref
  ) => {
    const { field } = form();
    return (
      <FormContext.Provider value={{ variant, size, floating, fancy }}>
        <div ref={ref} className={field({ size, className })} {...props}>
          {children}
        </div>
      </FormContext.Provider>
    );
  }
);

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & LabelProps
>(({ className, size: propSize, floating: propFloating, variant: propVariant, asTextarea, ...props }, ref) => {
  const ctx = useContext(FormContext);
  const { label } = form();
  return (
    <label
      ref={ref}
      className={label({
        size: propSize || ctx.size,
        floating: propFloating ?? ctx.floating,
        variant: propVariant || ctx.variant,
        asTextarea,
        className,
      })}
      {...props}
    />
  );
});

export const Message = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & MessageProps
>(({ className, size = "xs", ...props }, ref) => {
  const { message } = form();
  return <p ref={ref} className={message({ size, className })} {...props} />;
});

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    InputVariants {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ variant, fancy, className, size, ...props }, forwardedRef) => {
    const { input } = form();
    const ctx = useContext(FormContext);

    const resolvedVariant = variant || ctx.variant || "outlined";
    const resolvedSize = size || (ctx.size === "xs" ? "sm" : ctx.size) || "md";
    const resolvedFloating = ctx.floating;

    return (
      <input
        ref={forwardedRef}
        className={input({
          variant: resolvedVariant,
          fancy: fancy ?? ctx.fancy,
          size: resolvedSize,
          floating: resolvedFloating,
          className,
        })}
        {...props}
      />
    );
  }
);

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    InputVariants {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ variant, fancy, className, size, ...props }, forwardedRef) => {
    const { input, textarea } = form();
    const ctx = useContext(FormContext);

    const resolvedVariant = variant || ctx.variant || "outlined";
    const resolvedSize = size || (ctx.size === "xs" ? "sm" : ctx.size) || "md";
    const resolvedFloating = ctx.floating;

    return (
      <textarea
        ref={forwardedRef}
        className={input({
          variant: resolvedVariant,
          fancy: fancy ?? ctx.fancy,
          size: resolvedSize,
          floating: resolvedFloating,
          asTextarea: true,
          className: textarea({ className }),
        })}
        {...props}
      />
    );
  }
);

Field.displayName = "TailusField";
Label.displayName = "TailusLabel";
Message.displayName = "TailusMessage";
Input.displayName = "TailusInput";
Textarea.displayName = "TailusTextarea";

export default Input;

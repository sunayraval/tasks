import React from "react";
import {
  display,
  title,
  text,
  caption,
  codeTheme,
  kbdTheme,
  type DisplayProps,
  type TitleProps,
  type TextProps,
  type CaptionProps,
  type CodeThemeProps,
} from "@tailus/themer";

type HeadingAs = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "span";
type TextAs = "p" | "span" | "div" | "label";

export interface TailusTitleProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    TitleProps {
  as?: HeadingAs;
}

export const Title: React.FC<TailusTitleProps> = ({
  as: Component = "h2",
  size = "lg",
  weight = "semibold",
  align,
  className,
  children,
  ...props
}) => {
  return (
    <Component
      className={title({ size, weight, align, className })}
      {...props}
    >
      {children}
    </Component>
  );
};

export interface TailusDisplayProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    DisplayProps {
  as?: HeadingAs;
}

export const Display: React.FC<TailusDisplayProps> = ({
  as: Component = "h1",
  size = "4xl",
  weight = "bold",
  align,
  className,
  children,
  ...props
}) => {
  return (
    <Component
      className={display({ size, weight, align, className })}
      {...props}
    >
      {children}
    </Component>
  );
};

export interface TailusTextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    TextProps {
  as?: TextAs;
}

export const Text: React.FC<TailusTextProps> = ({
  as: Component = "p",
  size = "sm",
  weight = "normal",
  align,
  neutral,
  className,
  children,
  ...props
}) => {
  return (
    <Component
      className={text({ size, weight, align, neutral, className })}
      {...props}
    >
      {children}
    </Component>
  );
};

export interface TailusCaptionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    CaptionProps {
  as?: TextAs;
}

export const Caption: React.FC<TailusCaptionProps> = ({
  as: Component = "span",
  size = "xs",
  weight = "normal",
  align,
  neutral,
  className,
  children,
  ...props
}) => {
  return (
    <Component
      className={caption({ size, weight, align, neutral, className })}
      {...props}
    >
      {children}
    </Component>
  );
};

export interface TailusCodeProps
  extends React.HTMLAttributes<HTMLElement>,
    CodeThemeProps {}

export const Code: React.FC<TailusCodeProps> = ({
  intent = "gray",
  className,
  children,
  ...props
}) => {
  return (
    <code className={codeTheme({ intent, className })} {...props}>
      {children}
    </code>
  );
};

export const Kbd: React.FC<React.HTMLAttributes<HTMLElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <kbd className={kbdTheme({ className })} {...props}>
      {children}
    </kbd>
  );
};

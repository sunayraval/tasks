import React from "react";
import { badge, type BadgeProps } from "@tailus/themer";

export interface BadgeVariantsProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    BadgeProps {}

export const Badge: React.FC<BadgeVariantsProps> = ({
  className,
  children,
  intent = "primary",
  size = "sm",
  variant = "soft",
  ...props
}) => {
  return (
    <span className={badge[variant]({ intent, size, className })} {...props}>
      {children}
    </span>
  );
};

Badge.displayName = "TailusBadge";
export default Badge;

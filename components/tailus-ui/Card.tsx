import React from "react";
import {
  card,
  gradientCard,
  type CardProps as CardVariantsProps,
  type GradientCardProps,
} from "@tailus/themer";

interface InnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    GradientCardProps {}

const InnerCard: React.FC<InnerProps> = ({
  variant,
  children,
  className,
  ...props
}) => {
  const { inner } = gradientCard({ variant });
  return (
    <div className={inner({ className })} {...props}>
      {children}
    </div>
  );
};

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement | HTMLAnchorElement>,
    CardVariantsProps {
  gradient?: boolean;
  href?: string;
}

export const Card = React.forwardRef<
  HTMLDivElement | HTMLAnchorElement,
  CardProps
>(
  (
    {
      className,
      variant = "mixed",
      fancy = false,
      children,
      gradient = false,
      href,
      ...props
    },
    ref
  ) => {
    const { outer } = gradientCard({ variant });

    if (fancy && gradient) {
      throw new Error("The fancy and gradient props cannot be used together.");
    }

    if (gradient && (variant === "elevated" || variant === "soft")) {
      const GradientWrapper = href ? "a" : "div";
      return (
        <GradientWrapper
          ref={ref as any}
          className={outer({ className })}
          href={href}
          {...(props as any)}
        >
          <InnerCard variant={variant}>{children}</InnerCard>
        </GradientWrapper>
      );
    }

    const Element = href ? "a" : "div";
    return (
      <Element
        ref={ref as any}
        className={card({ variant, fancy, className })}
        href={href}
        {...(props as any)}
      >
        {children}
      </Element>
    );
  }
);

Card.displayName = "TailusCard";

export default Card;

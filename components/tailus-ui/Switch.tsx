"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import React, { useContext } from "react";
import { switchTheme, fancySwitch, type SwitchProps } from "@tailus/themer";

export interface SwitchVariantsProps extends SwitchProps {
  fancy?: boolean;
}

const SwitchContext = React.createContext<SwitchVariantsProps>({
  intent: "primary",
  fancy: false,
});

export const SwitchRoot = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> &
    SwitchVariantsProps
>(
  (
    { className, intent = "primary", fancy = false, ...props },
    forwardedRef
  ) => {
    const { root } = fancy ? fancySwitch({ intent }) : switchTheme({ intent });
    return (
      <SwitchContext.Provider value={{ intent, fancy }}>
        <SwitchPrimitive.Root
          className={root({ intent, className })}
          {...props}
          ref={forwardedRef}
        />
      </SwitchContext.Provider>
    );
  }
);

export const SwitchThumb = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Thumb>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Thumb> & SwitchProps
>(({ className, ...props }, forwardedRef) => {
  const { intent } = useContext(SwitchContext);
  const { thumb } = switchTheme({ intent });
  return (
    <SwitchPrimitive.Thumb
      className={thumb({ intent, className })}
      {...props}
      ref={forwardedRef}
    />
  );
});

SwitchRoot.displayName = "TailusSwitchRoot";
SwitchThumb.displayName = "TailusSwitchThumb";

export const Switch = {
  Root: SwitchRoot,
  Thumb: SwitchThumb,
};

export default Switch;

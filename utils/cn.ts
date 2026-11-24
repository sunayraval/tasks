import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

/**
 * Tailwind CSS classnames merge.
 * Resolves conflicting Tailwind CSS classnames and merges them into one.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clone React element and merge Tailwind CSS classnames into the cloned element.
 */
export function cloneElement(element: React.ReactElement, classNames: string) {
  return React.cloneElement(element, {
    className: twMerge(element.props?.className, classNames),
  });
}

import React from "react";
import { vi } from "vitest";

declare global {
  var ENABLE_INNER_HTML: boolean | undefined;
}

globalThis.ENABLE_INNER_HTML = false;

function createElement(tag: keyof React.JSX.IntrinsicElements) {
  return ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(tag, props, children);
}

vi.mock("@tarojs/components", () => {
  return {
    View: createElement("div"),
    Text: createElement("span"),
    Button: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("button", { type: "button", ...props }, children),
    Input: ({
      onInput,
      onChange,
      ...props
    }: Record<string, unknown> & {
      onInput?: (event: {
        detail: { value: string };
        target: HTMLInputElement;
      }) => void;
      onChange?: (event: {
        detail: { value: string };
        target: HTMLInputElement;
      }) => void;
    }) =>
      React.createElement("input", {
        ...props,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const payload = {
            detail: { value: event.target.value },
            target: event.target,
          };

          onInput?.(payload);
          onChange?.(payload);
        },
      }),
  };
});

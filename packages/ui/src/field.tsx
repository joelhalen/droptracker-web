/**
 * Form controls — one canonical field style, replacing the ~5 divergent local
 * `field`/`input` string constants that had drifted across the app (different
 * bg tokens, radii, and focus treatments). Everything routes through
 * `inputBaseClass`; `state="error"` swaps the focus ring to red.
 *
 * Server-safe (no hooks): these controls render in Server or Client Components.
 * The label/hint/error wrapper (`Field`) uses `useId` and so lives in its own
 * client module (./field-group).
 */
import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

export type FieldSize = "sm" | "md";
export type FieldState = "default" | "error";

const SIZE: Record<FieldSize, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-2 text-sm",
};

/** The canonical text-control style. Compose with a size + state. */
export const inputBaseClass =
  "text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded-lg border bg-osrs-surface-2 outline-none transition-colors focus:ring-2";

const STATE: Record<FieldState, string> = {
  default: "border-osrs-bronze/40 focus:border-osrs-gold focus:ring-osrs-gold/20",
  error: "border-osrs-red/60 focus:border-osrs-red focus:ring-osrs-red/20",
};

function controlClass(size: FieldSize, state: FieldState, className?: string): string {
  return cn(inputBaseClass, SIZE[size], STATE[state], className);
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fieldSize?: FieldSize;
  state?: FieldState;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { fieldSize = "md", state = "default", className, ...props },
  ref,
) {
  return <input ref={ref} className={controlClass(fieldSize, state, className)} {...props} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldSize?: FieldSize;
  state?: FieldState;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { fieldSize = "md", state = "default", className, ...props },
  ref,
) {
  return <textarea ref={ref} className={controlClass(fieldSize, state, className)} {...props} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fieldSize?: FieldSize;
  state?: FieldState;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { fieldSize = "md", state = "default", className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={controlClass(fieldSize, state, className)} {...props}>
      {children}
    </select>
  );
});

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Accent-colored checkbox. Wrap with a `<label>` for the clickable row. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn("accent-osrs-gold size-4 cursor-pointer", className)}
      {...props}
    />
  );
});

export type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** File picker with a styled `file:` button matching the ghost button look. */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="file"
      className={cn(
        "text-osrs-parchment-dark/80 w-full text-sm",
        "file:bg-osrs-bronze/60 file:text-osrs-parchment hover:file:bg-osrs-bronze file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium",
        className,
      )}
      {...props}
    />
  );
});


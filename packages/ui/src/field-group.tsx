"use client";

/**
 * Field — label + hint + error scaffold around a form control. Uses `useId`
 * (hence "use client") to wire up `htmlFor`/`id` and `aria-describedby` /
 * `aria-invalid` so callers don't hand-roll accessibility. The controls
 * themselves (Input/Textarea/Select/…) stay server-safe in ./field.
 *
 *   <Field label="Name" hint="As shown publicly" error={err}>
 *     {(p) => <Input {...p} value={v} onChange={…} state={err ? "error" : "default"} />}
 *   </Field>
 */
import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface FieldProps {
  label?: ReactNode;
  /** Muted help text under the control. */
  hint?: ReactNode;
  /** Error message; render your control with `state="error"` to match. */
  error?: ReactNode;
  /** Render-prop receiving the id/aria props to spread onto the control. */
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label htmlFor={id} className="text-osrs-parchment block text-sm font-medium">
          {label}
        </label>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-osrs-parchment-dark/50 text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-osrs-red text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

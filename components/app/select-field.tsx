"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_VALUE_SENTINEL = "__rms_empty__";

export interface SelectFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  icon?: React.ReactNode;
  className?: string;
}

export function SelectField({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  ariaLabel,
  disabled = false,
  size = "default",
  icon,
  className,
}: SelectFieldProps) {
  const encodedValue = value === "" ? EMPTY_VALUE_SENTINEL : value;

  return (
    <Select
      value={encodedValue}
      onValueChange={(next) => onValueChange(next === EMPTY_VALUE_SENTINEL ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn(className)}
      >
        {icon ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-muted-foreground">{icon}</span>
            <SelectValue placeholder={placeholder} />
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => {
          const itemValue = opt.value === "" ? EMPTY_VALUE_SENTINEL : opt.value;
          return (
            <SelectItem key={itemValue} value={itemValue} disabled={opt.disabled}>
              {opt.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

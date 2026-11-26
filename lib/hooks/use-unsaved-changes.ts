"use client";

import * as React from "react";

/**
 * Warns before closing/reloading browser tab when an editor has unsaved changes.
 */
export function useUnsavedChanges(isDirty: boolean) {
  React.useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}

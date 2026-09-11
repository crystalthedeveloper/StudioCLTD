import { isGameFocused, setGameFocused } from "./gameFocus";

/** Preserve the pre-guide pause state; closing never starts an already paused game. */
export function createGuidePauseSession() {
  let open = false;
  let resume = false;
  return {
    isOpen: () => open,
    open() {
      if (open) return false;
      resume = isGameFocused();
      open = true;
      setGameFocused(false);
      return true;
    },
    cancelResume() { resume = false; },
    close() {
      if (!open) return false;
      open = false;
      const shouldResume = resume;
      resume = false;
      return shouldResume;
    },
  };
}

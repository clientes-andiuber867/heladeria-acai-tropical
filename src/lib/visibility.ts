import { createContext, useContext, useSyncExternalStore } from "react";

export const SectionVisibility = createContext(true);
const subscribe = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const snapshot = () => document.visibilityState !== "hidden";
export const useDocumentVisible = () =>
  useSyncExternalStore(subscribe, snapshot, () => true);
export function usePageVisible() {
  const section = useContext(SectionVisibility);
  return useDocumentVisible() && section;
}

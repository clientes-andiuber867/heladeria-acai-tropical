/**
 * Safe UUID v4 generator and polyfill for environments where crypto.randomUUID
 * is not available (e.g., non-secure HTTP origins like http://192.168.x.x on mobile).
 */
export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to manual generation
    }
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fall through
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Polyfill window.crypto.randomUUID if undefined
if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as unknown as { crypto: unknown }).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    try {
      window.crypto.randomUUID = generateUUID as () => `${string}-${string}-${string}-${string}-${string}`;
    } catch {
      // Ignore if Object.defineProperty is restricted
    }
  }
}

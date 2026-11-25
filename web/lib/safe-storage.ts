export function getSafeSessionStorageItem(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSafeSessionStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined")
      window.sessionStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

export function removeSafeSessionStorageItem(key: string): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

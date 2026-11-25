export type SavedClient = {
  nickname: string;
  address: string;
};

const STORAGE_KEY = "payloop.clients";

function isSavedClient(value: unknown): value is SavedClient {
  if (!value || typeof value !== "object") return false;
  const client = value as Record<string, unknown>;
  return (
    typeof client.nickname === "string" &&
    client.nickname.trim().length > 0 &&
    typeof client.address === "string" &&
    /^G[A-Z2-7]{55}$/.test(client.address)
  );
}

export function parseSavedClients(raw: string | null): SavedClient[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedClient).map((client) => ({
      nickname: client.nickname.trim(),
      address: client.address,
    }));
  } catch {
    return [];
  }
}

export function loadSavedClients(): SavedClient[] {
  try {
    return typeof window === "undefined"
      ? []
      : parseSavedClients(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function storeSavedClients(clients: SavedClient[]): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    }
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

export function saveClient(client: SavedClient): SavedClient[] {
  const nickname = client.nickname.trim().slice(0, 40);
  if (!nickname || !/^G[A-Z2-7]{55}$/.test(client.address)) {
    return loadSavedClients();
  }
  const clients = loadSavedClients().filter(
    (saved) => saved.address !== client.address,
  );
  const next = [...clients, { nickname, address: client.address }];
  storeSavedClients(next);
  return next;
}

export function renameSavedClient(
  address: string,
  nickname: string,
): SavedClient[] {
  const trimmedNickname = nickname.trim().slice(0, 40);
  if (!trimmedNickname) return loadSavedClients();
  const next = loadSavedClients().map((client) =>
    client.address === address
      ? { ...client, nickname: trimmedNickname }
      : client,
  );
  storeSavedClients(next);
  return next;
}

export function deleteSavedClient(address: string): SavedClient[] {
  const next = loadSavedClients().filter(
    (client) => client.address !== address,
  );
  storeSavedClients(next);
  return next;
}

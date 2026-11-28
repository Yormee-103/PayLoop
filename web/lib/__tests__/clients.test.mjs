import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteSavedClient,
  loadSavedClients,
  parseSavedClients,
  renameSavedClient,
  saveClient,
} from "../clients.ts";

const address = `G${"A".repeat(55)}`;

test("parseSavedClients returns valid nickname and address pairs", () => {
  assert.deepEqual(
    parseSavedClients(JSON.stringify([{ nickname: "  Acme  ", address }])),
    [{ nickname: "Acme", address }],
  );
});

test("parseSavedClients ignores malformed storage and invalid entries", () => {
  assert.deepEqual(parseSavedClients("not json"), []);
  assert.deepEqual(
    parseSavedClients(JSON.stringify([
      { nickname: "", address },
      { nickname: "Bad address", address: "not-an-address" },
    ])),
    [],
  );
});

test("saved clients can be added, renamed, and deleted", () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    },
  });

  try {
    assert.deepEqual(saveClient({ nickname: "Acme", address }), [
      { nickname: "Acme", address },
    ]);
    assert.deepEqual(renameSavedClient(address, "Acme Studio"), [
      { nickname: "Acme Studio", address },
    ]);
    assert.deepEqual(loadSavedClients(), [
      { nickname: "Acme Studio", address },
    ]);
    assert.deepEqual(deleteSavedClient(address), []);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  }
});

test("saved clients tolerate unavailable localStorage", () => {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => {
          throw new Error("storage disabled");
        },
        setItem: () => {
          throw new Error("storage disabled");
        },
      },
    },
  });

  try {
    assert.deepEqual(loadSavedClients(), []);
    assert.deepEqual(saveClient({ nickname: "Acme", address }), [
      { nickname: "Acme", address },
    ]);
    assert.deepEqual(loadSavedClients(), []);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  }
});
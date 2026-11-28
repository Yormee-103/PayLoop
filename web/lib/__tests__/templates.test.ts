import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_TEMPLATES,
  deleteCustomTemplate,
  loadCustomTemplates,
  saveCustomTemplate,
} from "../templates";

function mockWindowStorage(storage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}) {
  vi.stubGlobal("window", { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BUILTIN_TEMPLATES", () => {
  it("provides default freelance invoice templates", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThan(0);
    for (const tpl of BUILTIN_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
    }
  });
});

describe("loadCustomTemplates", () => {
  it("returns an empty array when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(loadCustomTemplates()).toEqual([]);
  });

  it("returns an empty array when storage has no entry", () => {
    mockWindowStorage({
      getItem: () => null,
      setItem: () => {},
    });
    expect(loadCustomTemplates()).toEqual([]);
  });

  it("loads valid templates and filters out malformed entries", () => {
    const valid = {
      id: "custom-1",
      name: "Audit",
      description: "Security audit",
      amount: "500",
    };
    const invalid = { id: "custom-2", name: 123 };
    mockWindowStorage({
      getItem: () => JSON.stringify([valid, invalid, null]),
      setItem: () => {},
    });

    expect(loadCustomTemplates()).toEqual([valid]);
  });

  it("returns an empty array for non-array JSON or corrupt JSON", () => {
    mockWindowStorage({
      getItem: () => JSON.stringify({ not: "an array" }),
      setItem: () => {},
    });
    expect(loadCustomTemplates()).toEqual([]);

    mockWindowStorage({
      getItem: () => "{corrupt-json",
      setItem: () => {},
    });
    expect(loadCustomTemplates()).toEqual([]);
  });

  it("returns an empty array when localStorage.getItem throws", () => {
    mockWindowStorage({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    });
    expect(loadCustomTemplates()).toEqual([]);
  });
});

describe("saveCustomTemplate and deleteCustomTemplate", () => {
  it("saves trimmed templates and deletes by id", () => {
    const store = new Map<string, string>();
    mockWindowStorage({
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
    });
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);

    const saved = saveCustomTemplate("  Retainer  ", "  Monthly work  ", "  ");
    expect(saved).toEqual([
      {
        id: "custom-1700000000000",
        name: "Retainer",
        description: "Monthly work",
        amount: "",
      },
    ]);
    expect(loadCustomTemplates()).toEqual(saved);

    const remaining = deleteCustomTemplate("custom-1700000000000");
    expect(remaining).toEqual([]);
    expect(loadCustomTemplates()).toEqual([]);
  });

  it("does not throw when localStorage.setItem fails", () => {
    mockWindowStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(() =>
      saveCustomTemplate("Design", "Landing page", "300"),
    ).not.toThrow();
    expect(() => deleteCustomTemplate("missing")).not.toThrow();
  });
});

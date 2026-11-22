import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  getInitialTheme,
  getSystemTheme,
  applyTheme,
  STORAGE_KEY,
} from './theme';

describe('Theme & prefers-color-scheme logic', () => {
  let originalWindow: typeof global.window;
  let originalDocument: typeof global.document;

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    vi.restoreAllMocks();
  });

  it('falls back to dark when window or matchMedia is undefined', () => {
    // @ts-expect-error test SSR environment
    delete global.window;
    expect(getSystemTheme()).toBe('dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('detects OS light theme preference on first visit when nothing is stored', () => {
    const storage: Record<string, string> = {};
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('light'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    global.window = {
      matchMedia: matchMediaMock,
      localStorage: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
      },
    } as unknown as Window & typeof globalThis;

    expect(getSystemTheme()).toBe('light');
    expect(getInitialTheme()).toBe('light');
  });

  it('detects OS dark theme preference on first visit when nothing is stored', () => {
    const storage: Record<string, string> = {};
    const matchMediaMock = vi.fn().mockImplementation((_query: string) => ({
      matches: false,
      media: _query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    global.window = {
      matchMedia: matchMediaMock,
      localStorage: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
      },
    } as unknown as Window & typeof globalThis;

    expect(getSystemTheme()).toBe('dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('honors stored user preference over OS preference (stored light wins)', () => {
    const storage: Record<string, string> = {
      [STORAGE_KEY]: 'light',
    };
    const matchMediaMock = vi.fn().mockImplementation((_query: string) => ({
      matches: false,
      media: _query,
    }));

    global.window = {
      matchMedia: matchMediaMock,
      localStorage: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
      },
    } as unknown as Window & typeof globalThis;

    expect(getInitialTheme()).toBe('light');
  });

  it('honors stored user preference over OS preference (stored dark wins)', () => {
    const storage: Record<string, string> = {
      [STORAGE_KEY]: 'dark',
    };
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('light'),
      media: query,
    }));

    global.window = {
      matchMedia: matchMediaMock,
      localStorage: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
      },
    } as unknown as Window & typeof globalThis;

    expect(getInitialTheme()).toBe('dark');
  });

  it('falls back gracefully to OS preference when localStorage throws (private browsing mode)', () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('light'),
      media: query,
    }));

    global.window = {
      matchMedia: matchMediaMock,
      localStorage: {
        getItem: () => {
          throw new Error('Access denied in private browsing');
        },
        setItem: () => {
          throw new Error('Access denied in private browsing');
        },
      },
    } as unknown as Window & typeof globalThis;

    expect(getInitialTheme()).toBe('light');
  });

  it('applyTheme updates documentElement classes and colorScheme', () => {
    const classes = new Set<string>();
    const docElement = {
      classList: {
        toggle: (cls: string, force?: boolean) => {
          if (force === true) classes.add(cls);
          else if (force === false) classes.delete(cls);
          else if (classes.has(cls)) classes.delete(cls);
          else classes.add(cls);
        },
        contains: (cls: string) => classes.has(cls),
      },
      style: {
        colorScheme: '',
      },
    };

    global.document = {
      documentElement: docElement,
    } as unknown as Document;

    applyTheme('light');
    expect(docElement.classList.contains('light')).toBe(true);
    expect(docElement.classList.contains('dark')).toBe(false);
    expect(docElement.style.colorScheme).toBe('light');

    applyTheme('dark');
    expect(docElement.classList.contains('dark')).toBe(true);
    expect(docElement.classList.contains('light')).toBe(false);
    expect(docElement.style.colorScheme).toBe('dark');
  });
});

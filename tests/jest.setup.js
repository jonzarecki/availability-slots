const chrome = require('jest-chrome');

// Use modern global assignment
globalThis.chrome = chrome;

// Use native performance API
const startTime = process.hrtime.bigint();
globalThis.performance = {
  now: () => Number(process.hrtime.bigint() - startTime) / 1e6,
  timeOrigin: Date.now()
};

// Initialize Chrome API mocks
chrome.identity = {
  getAuthToken: jest.fn()
};

// Mock chrome.identity.getAuthToken
chrome.identity.getAuthToken.mockImplementation((details, callback) => {
  callback('mock-token');
});

// Mock chrome.storage.sync
chrome.storage = {
  sync: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn()
  }
};

// Mock chrome.runtime
chrome.runtime = {
  onInstalled: {
    addListener: jest.fn()
  },
  onMessage: {
    addListener: jest.fn()
  },
  getURL: jest.fn(),
  sendMessage: jest.fn(),
  lastError: null
};

// Mock chrome.contextMenus
chrome.contextMenus = {
  create: jest.fn(),
  onClicked: {
    addListener: jest.fn()
  }
};

// Mock chrome.tabs
chrome.tabs = {
  query: jest.fn(),
  sendMessage: jest.fn(),
  create: jest.fn()
};

// Mock chrome.windows
chrome.windows = {
  create: jest.fn()
};

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ items: [] })
  })
);

// Use native base64 encoding/decoding
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = str => Buffer.from(str).toString('base64');
}

if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = str => Buffer.from(str, 'base64').toString();
}

// Mock DOMException using native Error
if (typeof globalThis.DOMException === 'undefined') {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'Error';
      this.code = 0;
    }
  };
}

// Mock URL API if needed
if (typeof globalThis.URL === 'undefined') {
  globalThis.URL = class URL {
    constructor(url, base) {
      const fullUrl = base ? new URL(base).href + url : url;
      Object.assign(this, new URL(fullUrl));
    }
  };
}

// Mock Intl.DateTimeFormat
const mockTimeZone = 'America/New_York';
global.Intl = {
  DateTimeFormat: () => ({
    resolvedOptions: () => ({
      timeZone: mockTimeZone
    })
  })
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  chrome.runtime.lastError = null;
}); 
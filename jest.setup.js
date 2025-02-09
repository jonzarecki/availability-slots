const chrome = require('jest-chrome');

// Use modern global assignment
globalThis.chrome = chrome;
globalThis.performance = {
  now: () => Date.now(),
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
  getURL: jest.fn()
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

// Mock native APIs that might be used
globalThis.atob = str => Buffer.from(str, 'base64').toString('binary');
globalThis.btoa = str => Buffer.from(str, 'binary').toString('base64'); 
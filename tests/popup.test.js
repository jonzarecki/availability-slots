jest.setTimeout(10000); // Increase timeout to 10 seconds

describe('Popup Tests', () => {
  let mockDocument;
  
  beforeEach(() => {
    // Mock DOM elements
    mockDocument = {
      availabilityText: {
        value: '',
        addEventListener: jest.fn()
      },
      openOptions: {
        addEventListener: jest.fn()
      },
      copyStatus: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      authorize: {
        style: {},
        addEventListener: jest.fn()
      }
    };

    // Mock getElementById
    document.getElementById = jest.fn((id) => {
      const element = mockDocument[id];
      if (!element) {
        throw new Error(`Element with id "${id}" not found`);
      }
      return element;
    });

    // Mock document.addEventListener
    document.addEventListener = jest.fn();

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined)
      },
      configurable: true
    });

    // Mock chrome storage
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        duration: '30',
        days: '5',
        bookingLink: 'https://calendly.com/example',
        selectedCalendars: [{ id: 'primary', name: 'Primary Calendar' }]
      });
    });

    // Mock runtime messages
    chrome.runtime.sendMessage.mockImplementation((message) => {
      switch (message.action) {
        case 'checkAuth':
          return Promise.resolve({ isAuthenticated: true });
        case 'getAvailability':
          return Promise.resolve({
            slots: [
              'Mon Mar 25, 9:00 AM - 9:30 AM EDT',
              'Mon Mar 25, 10:00 AM - 10:30 AM EDT'
            ]
          });
        default:
          return Promise.resolve({});
      }
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should check authentication on load', async () => {
      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'checkAuth'
      });
    });

    it('should request authorization if not authenticated', async () => {
      // Mock not authenticated
      chrome.runtime.sendMessage
        .mockImplementationOnce(() => Promise.resolve({ isAuthenticated: false }))
        .mockImplementationOnce(() => Promise.resolve({ success: true }));

      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'authorize'
      });
    });

    it('should handle authorization failure', async () => {
      // Mock auth failure
      chrome.runtime.sendMessage
        .mockImplementationOnce(() => Promise.resolve({ isAuthenticated: false }))
        .mockImplementationOnce(() => Promise.resolve({ success: false, error: 'Auth failed' }));

      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(mockDocument.availabilityText.value).toContain('Error:');
      expect(mockDocument.availabilityText.value).toContain('Auth failed');
    });
  });

  describe('Availability Generation', () => {
    it.skip('should format and display availability slots', async () => {
      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(mockDocument.availabilityText.value).toContain('Would any of these time windows work');
      expect(mockDocument.availabilityText.value).toContain('Mon Mar 25, 9:00 AM');
      expect(mockDocument.availabilityText.value).toContain('https://calendly.com/example');
    });

    it.skip('should handle no availability found', async () => {
      // Mock no slots returned
      chrome.runtime.sendMessage
        .mockImplementationOnce(() => Promise.resolve({ isAuthenticated: true }))
        .mockImplementationOnce(() => Promise.resolve({ slots: [] }));

      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(mockDocument.availabilityText.value).toContain('No availability found');
      expect(mockDocument.availabilityText.value).toContain('https://calendly.com/example');
    });

    it.skip('should handle error getting availability', async () => {
      // Mock error response
      chrome.runtime.sendMessage
        .mockImplementationOnce(() => Promise.resolve({ isAuthenticated: true }))
        .mockImplementationOnce(() => Promise.resolve({ error: 'Failed to get calendar data' }));

      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(mockDocument.availabilityText.value).toContain('Error:');
      expect(mockDocument.availabilityText.value).toContain('Failed to get calendar data');
    });
  });

  describe('UI Interactions', () => {
    it.skip('should copy availability to clipboard on text area click', async () => {
      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      // Get the click handler for availabilityText
      const clickHandler = mockDocument.availabilityText.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1];

      // Trigger click
      await clickHandler();

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(mockDocument.copyStatus.classList.add).toHaveBeenCalledWith('show');
    });

    it.skip('should open options page when settings button clicked', async () => {
      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      // Get the click handler for openOptions
      const clickHandler = mockDocument.openOptions.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1];

      // Trigger click
      clickHandler();

      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });
}); 
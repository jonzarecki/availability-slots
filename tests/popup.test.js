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
    chrome.storage.sync.get.mockImplementation((keys) => {
      return Promise.resolve({
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
              {
                start: new Date('2024-03-25T09:00:00'),
                end: new Date('2024-03-25T09:30:00')
              },
              {
                start: new Date('2024-03-25T13:00:00'),
                end: new Date('2024-03-25T13:30:00')
              }
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
    it('should format and display availability slots', async () => {
      // Mock storage settings
      chrome.storage.sync.get.mockResolvedValue({
        duration: 30,
        days: 5,
        selectedCalendars: ['primary'],
        bookingLink: 'https://calendly.com/test'
      });

      // Mock successful auth check and diverse availability slots
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.action === 'checkAuth') {
          return Promise.resolve({ isAuthenticated: true });
        }
        if (message.action === 'getAvailability') {
          return Promise.resolve({
            slots: [
              // Day 1 slots
              {
                start: new Date('2024-03-25T09:00:00'),
                end: new Date('2024-03-25T09:30:00')
              },
              {
                start: new Date('2024-03-25T13:00:00'),
                end: new Date('2024-03-25T13:30:00')
              },
              // Day 2 slots
              {
                start: new Date('2024-03-26T10:00:00'),
                end: new Date('2024-03-26T10:30:00')
              },
              {
                start: new Date('2024-03-26T15:00:00'),
                end: new Date('2024-03-26T15:30:00')
              },
              // Day 3 slots
              {
                start: new Date('2024-03-27T11:00:00'),
                end: new Date('2024-03-27T11:30:00')
              }
            ]
          });
        }
        return Promise.resolve({});
      });

      // Load popup.js to register event listeners
      jest.isolateModules(() => {
        require('../popup');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify diverse slot distribution
      const text = mockDocument.availabilityText.value;
      expect(text).toContain('Would any of these time windows work for a 30 minute meeting');
      
      // Check for slots from different days
      expect(text).toMatch(/Mon,? Mar 25,? 9:00 AM - 9:30 AM/);
      expect(text).toMatch(/Mon,? Mar 25,? 1:00 PM - 1:30 PM/);
      expect(text).toMatch(/Tue,? Mar 26,? 10:00 AM - 10:30 AM/);
      expect(text).toMatch(/Tue,? Mar 26,? 3:00 PM - 3:30 PM/);
      expect(text).toMatch(/Wed,? Mar 27,? 11:00 AM - 11:30 AM/);
    });

    it('should handle no availability found', async () => {
      // Mock storage settings
      chrome.storage.sync.get.mockResolvedValue({
        duration: 30,
        days: 5,
        selectedCalendars: ['primary'],
        bookingLink: 'https://calendly.com/example'
      });

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

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockDocument.availabilityText.value).toContain('No availability found in the next 5 days');
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
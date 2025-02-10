jest.setTimeout(10000); // Increase timeout to 10 seconds

describe('Options Page Tests', () => {
  let mockDocument;
  
  beforeEach(() => {
    // Mock DOM elements
    mockDocument = {
      durationSelect: {
        value: '30',
        addEventListener: jest.fn()
      },
      daysSelect: {
        value: '5',
        addEventListener: jest.fn()
      },
      bookingLinkInput: {
        value: 'https://calendly.com/example',
        addEventListener: jest.fn()
      },
      calendarList: {
        innerHTML: '',
        addEventListener: jest.fn()
      },
      includeNoParticipants: {
        checked: false,
        addEventListener: jest.fn()
      },
      includeNoLocation: {
        checked: false,
        addEventListener: jest.fn()
      },
      includeAllDay: {
        checked: false,
        addEventListener: jest.fn()
      },
      saveStatus: {
        textContent: '',
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

    // Mock chrome storage
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        duration: '30',
        days: '5',
        bookingLink: 'https://calendly.com/example',
        selectedCalendars: [{ id: 'primary', name: 'Primary Calendar' }],
        includeNoParticipants: false,
        includeNoLocation: false,
        includeAllDay: false
      });
    });

    chrome.storage.sync.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });

    // Mock calendar list API response
    chrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.action === 'getCalendarList') {
        return Promise.resolve({
          items: [
            { id: 'primary', summary: 'Primary Calendar' },
            { id: 'secondary', summary: 'Secondary Calendar' }
          ]
        });
      }
      return Promise.resolve({});
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Settings Loading', () => {
    it.skip('should load saved settings on page load', async () => {
      // Load options.js to register event listeners
      jest.isolateModules(() => {
        require('../options');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(mockDocument.durationSelect.value).toBe('30');
      expect(mockDocument.daysSelect.value).toBe('5');
      expect(mockDocument.bookingLinkInput.value).toBe('https://calendly.com/example');
      expect(mockDocument.includeNoParticipants.checked).toBe(false);
      expect(mockDocument.includeNoLocation.checked).toBe(false);
      expect(mockDocument.includeAllDay.checked).toBe(false);
    });

    it.skip('should load calendar list', async () => {
      // Load options.js to register event listeners
      jest.isolateModules(() => {
        require('../options');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'getCalendarList'
      });
      expect(mockDocument.calendarList.innerHTML).toContain('Primary Calendar');
      expect(mockDocument.calendarList.innerHTML).toContain('Secondary Calendar');
    });
  });

  describe('Settings Validation', () => {
    it.skip('should validate duration input', async () => {
      // Load options.js to register event listeners
      jest.isolateModules(() => {
        require('../options');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      // Get the change handler for durationSelect
      const changeHandler = mockDocument.durationSelect.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      // Test invalid duration
      mockDocument.durationSelect.value = '0';
      await changeHandler();
      expect(mockDocument.saveStatus.textContent).toContain('Duration must be between 15 and 120 minutes');

      // Test valid duration
      mockDocument.durationSelect.value = '30';
      await changeHandler();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });

    it.skip('should validate days input', async () => {
      // Load options.js to register event listeners
      jest.isolateModules(() => {
        require('../options');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      // Get the change handler for daysSelect
      const changeHandler = mockDocument.daysSelect.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      // Test invalid days
      mockDocument.daysSelect.value = '0';
      await changeHandler();
      expect(mockDocument.saveStatus.textContent).toContain('Days must be between 1 and 30');

      // Test valid days
      mockDocument.daysSelect.value = '5';
      await changeHandler();
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('Settings Persistence', () => {
    it.skip('should save all settings when changed', async () => {
      // Load options.js to register event listeners
      jest.isolateModules(() => {
        require('../options');
      });

      // Trigger DOMContentLoaded
      const contentLoadedCallback = document.addEventListener.mock.calls.find(
        call => call[0] === 'DOMContentLoaded'
      )[1];
      await contentLoadedCallback();

      // Simulate changing multiple settings
      const settings = {
        duration: '45',
        days: '7',
        bookingLink: 'https://calendly.com/new',
        includeNoParticipants: true,
        includeNoLocation: true,
        includeAllDay: true,
        selectedCalendars: [{ id: 'secondary', name: 'Secondary Calendar' }]
      };

      // Update each setting
      Object.entries(settings).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          mockDocument[key].checked = value;
        } else if (key !== 'selectedCalendars') {
          if (key === 'duration') {
            mockDocument.durationSelect.value = value;
          } else if (key === 'days') {
            mockDocument.daysSelect.value = value;
          } else {
            mockDocument[`${key}Input`].value = value;
          }
        }
      });

      // Trigger save
      const saveHandler = mockDocument.durationSelect.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )[1];
      await saveHandler();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining(settings),
        expect.any(Function)
      );
    });
  });
}); 
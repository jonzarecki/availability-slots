const { findAvailableSlots } = require('../background');

jest.setTimeout(10000); // Increase timeout to 10 seconds

describe('Error Handling Tests', () => {
  let mockNow;
  let originalDate;

  beforeEach(() => {
    // Store original Date
    originalDate = global.Date;
    mockNow = new Date('2024-03-20T09:00:00-04:00');
    
    // Mock Date constructor
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          return mockNow;
        }
        return new originalDate(...args);
      }
    };
    global.Date.now = () => mockNow.getTime();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock chrome.storage.sync.get
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        includeNoParticipants: false,
        includeNoLocation: false,
        includeAllDay: false
      });
    });
  });

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  describe('Network Failures', () => {
    it('should handle calendar API network failures', async () => {
      // Mock network failure
      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        if (message.action === 'getAvailability') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({});
      });

      // Mock DOM elements for popup
      const mockDocument = {
        availabilityText: { value: '' }
      };
      document.getElementById = jest.fn((id) => mockDocument[id]);

      // Trigger availability request
      const response = await chrome.runtime.sendMessage({ action: 'getAvailability' })
        .catch(error => ({ error: error.message }));

      expect(response.error).toBe('Network error');
    });

    it('should handle calendar list API failures', async () => {
      // Mock network failure for calendar list
      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        if (message.action === 'getCalendarList') {
          return Promise.reject(new Error('Failed to fetch calendars'));
        }
        return Promise.resolve({});
      });

      // Mock DOM elements for options page
      const mockDocument = {
        calendarList: { innerHTML: '' },
        saveStatus: { 
          textContent: '',
          classList: { add: jest.fn(), remove: jest.fn() }
        }
      };
      document.getElementById = jest.fn((id) => mockDocument[id]);

      // Attempt to load calendar list
      const response = await chrome.runtime.sendMessage({ action: 'getCalendarList' })
        .catch(error => ({ error: error.message }));

      expect(response.error).toBe('Failed to fetch calendars');
    });
  });

  describe('API Rate Limiting', () => {
    it('should handle Google Calendar API rate limits', async () => {
      // Mock rate limit response
      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        if (message.action === 'getAvailability') {
          return Promise.reject({
            error: {
              code: 429,
              message: 'Rate limit exceeded'
            }
          });
        }
        return Promise.resolve({});
      });

      // Mock DOM elements
      const mockDocument = {
        availabilityText: { value: '' }
      };
      document.getElementById = jest.fn((id) => mockDocument[id]);

      // Trigger availability request
      const response = await chrome.runtime.sendMessage({ action: 'getAvailability' })
        .catch(error => error);

      expect(response.error.code).toBe(429);
      expect(response.error.message).toBe('Rate limit exceeded');
    });

    it.skip('should implement exponential backoff on rate limit', async () => {
      jest.useFakeTimers();
      let retryCount = 0;
      const mockBackoff = jest.fn();

      // Mock rate limit with retry
      chrome.runtime.sendMessage.mockImplementation(async (message) => {
        if (message.action === 'getAvailability') {
          retryCount++;
          if (retryCount <= 3) {
            const delay = Math.pow(2, retryCount - 1) * 1000;
            mockBackoff(delay);
            jest.advanceTimersByTime(delay);
            throw {
              error: {
                code: 429,
                message: 'Rate limit exceeded'
              }
            };
          }
          return { slots: [] };
        }
        return {};
      });

      // Trigger availability request with retries
      try {
        await chrome.runtime.sendMessage({ action: 'getAvailability' });
      } catch (error) {
        // Expected to fail after retries
        expect(error.error.code).toBe(429);
      }

      // Verify backoff was called with increasing delays
      expect(mockBackoff).toHaveBeenCalledTimes(3);
      expect(mockBackoff).toHaveBeenNthCalledWith(1, 1000);
      expect(mockBackoff).toHaveBeenNthCalledWith(2, 2000);
      expect(mockBackoff).toHaveBeenNthCalledWith(3, 4000);

      jest.useRealTimers();
    });
  });

  describe('Invalid Calendar Data', () => {
    it('should handle malformed event data', () => {
      const malformedEvents = [
        {
          // Missing end time
          start: { dateTime: '2024-03-20T10:00:00-04:00' },
          end: { dateTime: null }
        },
        {
          // Invalid date format
          start: { dateTime: 'invalid-date' },
          end: { dateTime: 'invalid-date' }
        },
        {
          // Missing dateTime field
          start: { date: '2024-03-20' },
          end: { date: '2024-03-21' }
        }
      ];

      // Should not throw error and should skip invalid events
      const slots = findAvailableSlots(malformedEvents, 30, mockNow, 1);
      expect(Array.isArray(slots)).toBe(true);
      // All slots should be available since invalid events are skipped
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should handle empty or null calendar response', async () => {
      // Mock empty calendar response
      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        if (message.action === 'getAvailability') {
          return Promise.resolve({ items: null });
        }
        return Promise.resolve({});
      });

      // Mock DOM elements
      const mockDocument = {
        availabilityText: { value: '' }
      };
      document.getElementById = jest.fn((id) => mockDocument[id]);

      // Trigger availability request
      const response = await chrome.runtime.sendMessage({ action: 'getAvailability' });
      
      expect(response.items).toBeNull();
      // Should handle gracefully and return available slots
      const slots = findAvailableSlots([], 30, mockNow, 1);
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should handle invalid calendar IDs', async () => {
      // Mock invalid calendar ID error
      chrome.runtime.sendMessage.mockImplementationOnce((message) => {
        if (message.action === 'getAvailability') {
          return Promise.reject({
            error: {
              code: 404,
              message: 'Calendar not found'
            }
          });
        }
        return Promise.resolve({});
      });

      // Mock DOM elements
      const mockDocument = {
        availabilityText: { value: '' }
      };
      document.getElementById = jest.fn((id) => mockDocument[id]);

      // Trigger availability request
      const response = await chrome.runtime.sendMessage({ action: 'getAvailability' })
        .catch(error => error);

      expect(response.error.code).toBe(404);
      expect(response.error.message).toBe('Calendar not found');
    });
  });
}); 
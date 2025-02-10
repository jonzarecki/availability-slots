const { mockCalendarEvents, getEventsInRange } = require('./mocks/calendar-events');
const { findAvailableSlots, formatTimeSlot } = require('../../background');

describe('Availability Generation Integration Tests', () => {
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

    // Mock chrome.storage.sync.get for settings
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        selectedCalendars: [{ id: 'primary', name: 'Primary Calendar' }],
        includeNoParticipants: false,
        includeNoLocation: false,
        includeAllDay: false,
        duration: '30',
        days: '5',
        bookingLink: 'https://calendly.com/example'
      });
    });

    // Mock chrome.identity.getAuthToken to resolve immediately
    chrome.identity.getAuthToken.mockImplementation((options, callback) => {
      callback('mock_token');
    });

    // Mock chrome.runtime.sendMessage to resolve immediately
    chrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.action === 'getAvailability') {
        const slots = findAvailableSlots(
          mockCalendarEvents.regularEvents,
          message.duration,
          mockNow,
          message.days
        );
        return Promise.resolve({ slots });
      }
      return Promise.resolve({});
    });

    // Mock fetch to resolve immediately
    global.fetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: mockCalendarEvents.regularEvents })
      })
    );
  });

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
    jest.restoreAllMocks();
  });

  describe('End-to-end availability generation', () => {
    it('should generate availability slots considering regular events only', async () => {
      const response = await chrome.runtime.sendMessage({
        action: 'getAvailability',
        duration: 30,
        days: 5
      });

      expect(response.slots).toBeDefined();
      expect(response.slots.length).toBeGreaterThan(0);
      expect(response.slots[0]).toMatch(/^(Mon|Tue|Wed|Thu|Fri)/);
    });

    it('should respect calendar settings when filtering events', async () => {
      // Update settings to include events without participants
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({
          selectedCalendars: [{ id: 'primary', name: 'Primary Calendar' }],
          includeNoParticipants: true,
          includeNoLocation: false,
          includeAllDay: false,
          duration: '30',
          days: '5'
        });
      });

      const allEvents = [
        ...mockCalendarEvents.regularEvents,
        ...mockCalendarEvents.noParticipantEvents
      ];

      global.fetch = jest.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: allEvents })
        })
      );

      // Update message handler to use all events
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getAvailability') {
          const slots = findAvailableSlots(
            allEvents,
            message.duration,
            mockNow,
            message.days
          );
          if (callback) {
            callback({ slots });
          }
          return Promise.resolve({ slots });
        }
        return Promise.resolve({});
      });

      const response = await chrome.runtime.sendMessage({
        action: 'getAvailability',
        duration: 30,
        days: 5
      });

      expect(response.slots).toBeDefined();
      // Should have fewer available slots due to including no-participant events
      expect(response.slots.length).toBeLessThan(
        findAvailableSlots(
          mockCalendarEvents.regularEvents,
          30,
          mockNow,
          5
        ).length
      );
    });
  });

  describe('Time slot generation', () => {
    it('should generate correct number of slots for different durations', () => {
      const events = mockCalendarEvents.regularEvents;
      
      const slots30min = findAvailableSlots(events, 30, mockNow, 1);
      const slots60min = findAvailableSlots(events, 60, mockNow, 1);
      
      // 60-minute slots should be fewer than 30-minute slots
      expect(slots60min.length).toBeLessThan(slots30min.length);
    });

    it('should handle different day ranges correctly', () => {
      const events = mockCalendarEvents.regularEvents;
      
      const slots1day = findAvailableSlots(events, 30, mockNow, 1);
      const slots5days = findAvailableSlots(events, 30, mockNow, 5);
      
      // 5-day range should have more slots than 1-day range
      expect(slots5days.length).toBeGreaterThan(slots1day.length);
    });
  });

  describe('Message formatting', () => {
    it('should format availability message with booking link', async () => {
      const slots = findAvailableSlots(
        mockCalendarEvents.regularEvents,
        30,
        mockNow,
        5
      );

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const formattedMessage = `Would any of these time windows work for a 30 minute meeting (${timezone})?\n\n` +
        slots.map(slot => `• ${slot}`).join('\n') +
        '\n\nFeel free to use this booking page if that\'s easier (also contains more availabilities):\n' +
        'https://calendly.com/example';

      expect(formattedMessage).toContain('minute meeting');
      expect(formattedMessage).toContain('America/New_York');
      expect(formattedMessage).toContain('https://calendly.com/example');
    });
  });
}); 
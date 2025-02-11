const { mockCalendarEvents } = require('./mocks/calendar-events');
const { findAvailableSlots } = require('../../background');

describe('Slot Diversity Tests', () => {
  let mockNow;
  let originalDate;
  
  beforeEach(() => {
    mockNow = new Date('2024-03-20T09:00:00-04:00');
    originalDate = global.Date;
    
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          return mockNow;
        }
        return new originalDate(...args);
      }
    };
    global.Date.now = () => mockNow.getTime();
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  describe('Slot diversity with maxSlots', () => {
    it('should return diverse slots across different days when maxSlots is set', () => {
      const events = mockCalendarEvents.regularEvents;
      const maxSlots = 3;
      
      const slots = findAvailableSlots(events, 30, mockNow, 5, { maxSlots, diversify: true });
      
      // Should return exactly maxSlots number of slots
      expect(slots.length).toBe(maxSlots);
      
      // Extract dates from slots to check diversity
      const dates = slots.map(slot => slot.split(',')[0]); // Extracts day from "Wed, Mar 20"
      const uniqueDates = new Set(dates);
      
      // Should have slots from different days (maxSlots different days if possible)
      expect(uniqueDates.size).toBe(maxSlots);
    });

    it('should handle case when fewer slots are available than maxSlots', () => {
      const events = mockCalendarEvents.regularEvents;
      const maxSlots = 10;
      
      // Only look at 2 days to limit available slots
      const slots = findAvailableSlots(events, 30, mockNow, 2, { maxSlots, diversify: true });
      
      // Should return all available slots if fewer than or equal to maxSlots
      expect(slots.length).toBeLessThanOrEqual(maxSlots);
      
      // Extract dates from slots
      const dates = slots.map(slot => slot.split(',')[0]);
      const uniqueDates = new Set(dates);
      
      // Should still try to diversify across available days
      expect(uniqueDates.size).toBeGreaterThanOrEqual(1);
    });

    it('should maintain time-based sorting within each day', () => {
      const events = mockCalendarEvents.regularEvents;
      const maxSlots = 4;
      
      const slots = findAvailableSlots(events, 30, mockNow, 5, { maxSlots, diversify: true });
      
      // Group slots by date
      const slotsByDate = {};
      slots.forEach(slot => {
        const date = slot.split(',')[0];
        if (!slotsByDate[date]) slotsByDate[date] = [];
        slotsByDate[date].push(slot);
      });

      // Check that slots within each day are sorted by time
      Object.values(slotsByDate).forEach(daySlots => {
        const times = daySlots.map(slot => {
          const timeStr = slot.split(' - ')[0].split(', ')[1];
          return new Date(`2024-01-01 ${timeStr}`).getTime();
        });
        
        const sortedTimes = [...times].sort((a, b) => a - b);
        expect(times).toEqual(sortedTimes);
      });
    });
  });
}); 
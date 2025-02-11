// Mock calendar events for testing
const mockCalendarEvents = {
  // Regular events with participants and location (default busy)
  regularEvents: [
    {
      id: '1',
      summary: 'Team Meeting',
      start: {
        dateTime: '2024-03-20T10:00:00-04:00'
      },
      end: {
        dateTime: '2024-03-20T11:00:00-04:00'
      },
      attendees: [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' }
      ],
      location: 'Conference Room A'
      // No transparency field = default busy (opaque)
    },
    {
      id: '2',
      summary: 'Project Review',
      start: {
        dateTime: '2024-03-20T14:00:00-04:00'
      },
      end: {
        dateTime: '2024-03-20T15:00:00-04:00'
      },
      attendees: [
        { email: 'user3@example.com' }
      ],
      hangoutLink: 'https://meet.google.com/abc-defg-hij'
      // No transparency field = default busy (opaque)
    }
  ],

  // Free events (explicitly marked as free)
  freeEvents: [
    {
      id: '3',
      summary: 'Optional Team Social',
      start: {
        dateTime: '2024-03-20T12:00:00-04:00'  // Between Team Meeting and Project Review
      },
      end: {
        dateTime: '2024-03-20T13:00:00-04:00'
      },
      transparency: 'transparent' // Explicitly marked as free
    },
    {
      id: '4',
      summary: 'Lunch Break',
      start: {
        dateTime: '2024-03-20T16:00:00-04:00'  // After Project Review
      },
      end: {
        dateTime: '2024-03-20T17:00:00-04:00'
      },
      transparency: 'transparent' // Explicitly marked as free
    }
  ],

  // Events without location
  noLocationEvents: [
    {
      id: '5',
      summary: 'Quick Sync',
      start: {
        dateTime: '2024-03-21T13:00:00-04:00'
      },
      end: {
        dateTime: '2024-03-21T13:30:00-04:00'
      },
      attendees: [
        { email: 'user4@example.com' }
      ]
      // No transparency field = default busy (opaque)
    }
  ],

  // All-day events
  allDayEvents: [
    {
      id: '6',
      summary: 'Company Holiday',
      start: {
        date: '2024-03-22'
      },
      end: {
        date: '2024-03-23'
      }
      // No transparency field = default busy (opaque)
    }
  ]
};

// Helper function to get events based on date range
const getEventsInRange = (startDate, endDate) => {
  const allEvents = [
    ...mockCalendarEvents.regularEvents,
    ...mockCalendarEvents.freeEvents,
    ...mockCalendarEvents.noLocationEvents,
    ...mockCalendarEvents.allDayEvents
  ];
  return allEvents;
};

module.exports = {
  mockCalendarEvents,
  getEventsInRange
}; 
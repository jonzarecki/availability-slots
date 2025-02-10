// Mock calendar events for testing
const mockCalendarEvents = {
  // Regular events with participants and location
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
    }
  ],

  // Events without participants
  noParticipantEvents: [
    {
      id: '3',
      summary: 'Focus Time',
      start: {
        dateTime: '2024-03-21T09:00:00-04:00'
      },
      end: {
        dateTime: '2024-03-21T10:00:00-04:00'
      }
    }
  ],

  // Events without location
  noLocationEvents: [
    {
      id: '4',
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
    }
  ],

  // All-day events
  allDayEvents: [
    {
      id: '5',
      summary: 'Company Holiday',
      start: {
        date: '2024-03-22'
      },
      end: {
        date: '2024-03-23'
      }
    }
  ]
};

// Helper function to get events based on date range
const getEventsInRange = (startDate, endDate) => {
  const allEvents = [
    ...mockCalendarEvents.regularEvents,
    ...mockCalendarEvents.noParticipantEvents,
    ...mockCalendarEvents.noLocationEvents,
    ...mockCalendarEvents.allDayEvents
  ];

  return allEvents.filter(event => {
    const eventStart = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date);
    return eventStart >= startDate && eventStart <= endDate;
  });
};

module.exports = {
  mockCalendarEvents,
  getEventsInRange
}; 
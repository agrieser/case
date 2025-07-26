# Trace - Slack Incident Management App

## Api

```
# Create new investigation (becomes current in channel)
/trace investigate "payment API issues"
# → Creates: trace-financial-eagle-a3f2 (contextual name based on title)
# → Sets as current investigation for this channel

# Reply to any message to add it as an event
/trace event
# → Adds the message you replied to as an event to current investigation
# → Must be used as a reply to capture message link

# Show current investigation status
/trace status
# → Shows: name, title, event count, created time, current status

# Escalate current investigation to incident
/trace incident
# → Escalates current investigation to incident status
# → Creates incident record linked to investigation

# Switch to different investigation in this channel
/trace switch trace-silver-dolphin-b4c1
# → Makes trace-silver-dolphin-b4c1 the current investigation in this channel
```

## Schema:

```
-- Investigations table
investigations:
- name (text, PRIMARY KEY)           -- "trace-financial-eagle-a3f2"
- title (text)                       -- "payment API issues"
- status (enum)                      -- 'investigating', 'escalated', 'resolved'
- channel_id (text)                  -- Slack channel where investigation is active
- created_by (text)                  -- Slack user ID
- created_at (timestamp)

-- Events table (always belong to investigations)
events:
- id (uuid, PRIMARY KEY)
- investigation_name (text, FOREIGN KEY → investigations.name)
- slack_message_url (text)           -- Link to the Slack message
- added_by (text)                    -- Slack user ID who added event
- added_at (timestamp)

-- Incidents table (escalated investigations)
incidents:
- investigation_name (text, PRIMARY KEY, FOREIGN KEY → investigations.name)
- incident_commander (text)          -- Slack user ID
- escalated_at (timestamp)
```

## Tools

- **Language**: TypeScript/Node.js
- **Framework**: Slack Bolt framework
- **Database**: PostgreSQL with Prisma ORM

Key Features
Channel-Scoped Current Investigation

Each Slack channel remembers its "current investigation"
Commands like /trace event and /trace incident operate on current investigation
Use /trace switch to change current investigation in a channel

Contextual Names

Auto-generate names based on investigation title (e.g., "payment issue" → "trace-financial-eagle-a3f2")
Keywords in title map to relevant descriptors (database → persistent, API → swift, etc.)
Includes 4-character hash suffix for uniqueness
Same name used for investigation → incident lifecycle
Easy to reference and remember in conversation

Events as Message Links

Events are always Slack message URLs
Use reply pattern: reply to any message with /trace event
Preserves full context in original message location

Project Structure
Set up a clean TypeScript project with:

Proper error handling and logging
Environment configuration
Database migrations with Prisma
Slack app manifest
Channel state management (current investigation per channel)

Success Criteria

Simple 5-command interface that's easy to remember
Reply pattern for adding events feels natural
Memorable investigation names reduce friction
Channel-scoped context eliminates UUID juggling
Clean data model supporting investigation → incident progression

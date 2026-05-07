# 📋 Activity Log - Track every bot action

The log is the **live camera** of GroupGuard. Every action the bot takes is recorded here with date, time, and full details.

---

## Why does it matter?

🔍 **Full transparency** — see what the bot is doing and why
⚖️ **Legal protection** — record if anyone claims they were wrongly blocked
📊 **Improving settings** — spot patterns (which spam type is most common)
🐛 **Debugging** — if something doesn't work as expected

---

## What you see in the log?

Each row contains:

| Column | What it is |
|---|---|
| 🕐 **Time** | Exact date and time |
| 🏷️ **Action type** | What the bot did |
| 👤 **User** | Who the action targeted (click opens profile) |
| 💬 **Group** | In which group it happened |
| 📝 **Reason** | Why the bot acted this way |
| 🔄 **Status** | Succeeded / failed / pending |
| 🎯 **Action** | Manual detail / undo |

---

## Action types you'll see

### 🟢 Positive actions
- **Member joined** — someone new joined the group
- **First message** — member started talking
- **Profile upgraded** — AI updated user details
- **Added to whitelist** — manually added

### 🟡 Cautious actions
- **Warning issued** — sent a private message
- **Admin tagged** — flagged the admins about something suspicious
- **Message hidden** — temporarily deleted pending approval

### 🔴 Enforcement actions
- **Message deleted** — permanently removed
- **User removed** — kicked from the group
- **Global block** — added to the spammer database

### ⚙️ System actions
- **Setting changed** — who changed what and when
- **Group added / removed**
- **Data sync**

---

## Advanced filters

The log can get crowded. The sidebar filters help:

### 📅 By time
- Today / 24 hours / 7 days / 30 days / custom range

### 🏷️ By action type
- Multi-select — check only what interests you

### 👥 By group
- All groups / one group / a few specific ones

### 🚦 By status
- Succeeded / failed / pending

### 🤖 By initiator
- Auto bot / user (which?) / system

---

## Row actions

Right-clicking a row (or the three dots) opens a menu:

- 🔍 **Full details** — dialog with all the data
- ↩️ **Undo action** — if the bot made a mistake (e.g., removed a real member by mistake)
- ⭐ **Add to whitelist** — if it's a recurring mistake
- 🚫 **Confirm this** — flag the sender as spammer if the bot missed it
- 📄 **Save as example** — AI training will learn from this

---

## How does undo work?

If the bot removed a user by mistake:

1. Find the action in the log
2. Click **"Undo action"** ↩️
3. The bot sends a **re-invite** to the group (as long as less than 24 hours passed)
4. Option to add a **note** ("apology, was a mistake")

> ⚠️ **Note:** Undo only works if the bot is admin **and still** admin in the group.

---

## Export the log

🔄 **Export to CSV** — download a specific period to Excel
📊 **Export to PDF** — formatted report for printing / sending
🔗 **API endpoint** — integration with other systems (Business plans+)

---

## Retention period

- **Trial plan** — 7 days
- **Starter** — 30 days
- **Business** — 90 days
- **Enterprise** — one year + archive on request

> 💡 **Tip:** At the end of each month, export the log to CSV and keep it in a personal archive. Takes 30 seconds and saves headaches later.

---

## Quick search

The search box at the top understands:
- User name / phone
- Group name
- Words in the reason (`"suspicious link"`, `"Nigeria"`)
- Combinations: `"removal" + "Petah Tikva"`

---

## Reporting errors

Saw an action by the bot that doesn't make sense?

1. Select the row
2. Click **"Report a problem"** 🚩
3. Add a description
4. The TaskFlow team gets a direct alert

---

## What's next?

- 👥 [Back to the member list](./03-members.md)
- ⚙️ [Update group settings](./04-groups.md)
- ❓ [FAQ on the log](./08-faq.md)

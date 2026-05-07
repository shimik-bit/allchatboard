# ⚙️ Group Management - Enable, disable, and settings

The **Groups** tab is where you choose which groups the bot guards and how.

---

## How do groups appear?

Groups are **added automatically** when the bot receives the first message from them. No need to add them manually.

If you've added the bot to a group and don't see it:
1. Make sure you've sent **at least one message** in the group
2. Click **"Scan groups"** at the top
3. Refresh the page

---

## What you see for each group

For each group in the list you'll see:

### In the main row
- 🖼️ **Group image** (if any)
- 📛 **Group name**
- 👥 **Number of members**
- 💬 **Messages this week**
- 🚫 **Spammers detected**

### Enable toggle ⚡
- **On** = GroupGuard active in this group
- **Off** = bot is there, but not taking action

### Bot status badge
- 👑 **Admin** — can do everything
- 👤 **Member** — sees everything, can't remove

---

## Per-group settings (click the gear ⚙️)

Clicking a group opens an advanced settings dialog:

### 🛡️ Protection level
- **Soft** — warnings only, removes no one
- **Medium** (default) — warns twice, then removes
- **Strong** — removes spam immediately
- **Custom** — you decide what happens for each case

### 📋 Spam detection rules
Choose which message types count as spam in this group:
- ✅ Links shortly after joining
- ✅ Identical message duplicated across groups
- ✅ Out-of-context promotions
- ✅ Gambling / sexual messages
- ✅ Prefixes from blocked countries
- ✅ Numbers from the global database

### 🎯 Actions on detection
What to do when the bot detects spam:
- **Delete the message** (requires admin)
- **Send private warning to sender**
- **Tag the group's admins**
- **Remove sender after X warnings**
- **Log only** (learning mode)

### 👥 Team permissions
Who can change settings **of this specific group**:
- **Only me** (owner)
- **All TaskFlow admins**
- **Custom team members**

### 🔇 Quiet hours
Periods when the bot **does not** take action (only logs):
- Days of the week
- Time range
- Auto holidays

---

## Bulk actions

Select multiple groups with the checkbox on the side and apply an action to all:
- 🟢 Enable GroupGuard
- 🔴 Disable GroupGuard
- ⚙️ Copy settings from another group
- 📤 Export data

> 💡 **Tip for power users with many groups:** Configure one group exactly the way you want, then use **"Copy settings to all groups"** from the top menu.

---

## Search and filter

Search box at the top filters by:
- Group name
- Member count (large / small)
- Bot status (admin / member)
- Activity (active / quiet)

---

## FAQ

**What happens if I disable the toggle?**
The bot stays in the group but does nothing. Stats still get collected, but no protection actions run.

**Can I delete a group from the list?**
Yes — but it's better to just remove the bot from the group. If you delete in TaskFlow, the group will return as soon as you send a message.

**The group has grown a lot — how do I keep performance good?**
We recommend raising the **protection level** to "strong" and enabling **admin tagging** instead of auto-removal.

---

## What's next?

- 🌍 [Configure prefix blocking](./05-prefixes.md)
- ⭐ [Manage the whitelist](./06-whitelist.md)
- 📋 [Track the log](./07-log.md)

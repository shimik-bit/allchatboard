# 👥 Group Members - Automatic profiles

This tab is the **brain** of GroupGuard. The bot automatically builds a profile for every person who writes in your groups — without you doing anything.

---

## What's in each profile?

### Basics
- 🖼️ **Profile picture** from WhatsApp
- 📱 **Phone number**
- 🌍 **Country** (by prefix)
- 📅 **First-joined date** to a group of yours

### Automatic AI analysis
The bot reads messages (doesn't store them!) and infers:
- 💼 **Profession / field of work** ("accountant", "renovation contractor", "real estate agent")
- 🎯 **Interests** (multiple tags)
- 💬 **Communication style** (active / quiet / asks a lot / helps a lot)
- ⭐ **Trust score** (1-100, based on history and activity)

### Statistics
- Number of messages they've written
- Groups they're a member of
- Percentage of messages with replies
- Peak activity hours

---

## Smart search

The search box at the top understands **natural-language questions**:

| What you type | What it finds |
|---|---|
| `renovation contractor in Petah Tikva` | People with that profession and location |
| `everyone who works in real estate` | Real estate tag across all groups |
| `054*` | All numbers starting with 054 |
| `active this month` | Anyone who wrote in the last 30 days |

> 💡 **Practical use:** Looking for a customer? "Who in my groups does interior design?" — get a list and reach out directly.

---

## Actions on a member

Clicking a row opens the full profile. From here you can:

- 📞 **Send a direct message** (opens WhatsApp with the number)
- ⭐ **Add to whitelist** (will never be flagged as spam)
- 🚫 **Mark as spam** (will be removed from all your groups)
- 📝 **Add a private note** (only you see it)
- 🏷️ **Add custom tags** ("VIP customer", "partner", etc.)

---

## Useful filters

In the sidebar there are filters:
- **By country** — map view
- **By group** — who's in each group
- **By field** — auto categories
- **By trust score** — under 30, 30-70, over 70
- **By join date** — new / veteran

---

## Export data

The **"Export to Excel"** button downloads all members with their data.

> ⚠️ **Note:** The export only includes data visible in the group. It doesn't violate privacy — but **don't pass** the file to someone who isn't a group member.

---

## Privacy and security

- ❌ The bot **doesn't store** message content
- ✅ Stores only **metadata** (who, when, message type)
- ✅ AI analysis happens **in real-time** and no text is saved
- ✅ You own the data — deleting a member deletes **everything**

---

## What's next?

- ⚙️ [Manage the groups themselves](./04-groups.md)
- ⭐ [Understand the whitelist](./06-whitelist.md)
- ❓ [Privacy FAQ](./08-faq.md)

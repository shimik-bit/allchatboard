# 🌍 Blocked Prefixes - Block by country

This tab lets you block numbers coming from specific countries. Especially useful when most spam comes from a fixed source.

---

## Why block whole prefixes?

The statistic is clear: **80% of spam in WhatsApp groups comes from foreign prefixes** (mainly Asia and Africa).

With one click you block thousands of potential spammers without affecting any real customer.

---

## How does it work?

1. Pick countries from the list
2. The bot checks every number that joins / writes
3. If the prefix is blocked — it **auto-removes** or **sends an alert** (according to the settings)

---

## Pre-made lists

Clicking "Smart lists" shows options:

### 🚨 High-risk prefixes (recommended)
Countries with an **especially high spam rate** in groups:
- 🇮🇳 India (+91)
- 🇵🇰 Pakistan (+92)
- 🇧🇩 Bangladesh (+880)
- 🇳🇬 Nigeria (+234)
- 🇮🇩 Indonesia (+62)
- 🇵🇭 Philippines (+63)

### 💼 Local only (strict)
Blocks **everything that's not your country code**. Useful for local-only groups.

### 🌍 EU + local only
Allows only European prefixes + your country. Good for international businesses.

---

## Manual addition

You can add specific prefixes:

1. Click **"Add prefix"**
2. Enter the prefix (e.g., `+234` or just `234`)
3. Choose action:
   - **Block immediately** — removed at join time
   - **Log only** — monitoring mode
4. Add a note (optional)

---

## Current prefix list

The table shows for each prefix:

| Column | What it is |
|---|---|
| 🏳️ **Flag + country** | Quick identification |
| 📞 **Prefix** | The number itself |
| 🚫 **Blocked** | How many people were blocked with this prefix |
| 📅 **Date added** | When you decided to block |
| ⚙️ **Actions** | Edit / remove |

---

## Edge cases and what to do

### "I have a real customer with a blocked prefix — what do I do?"
Add them to the [whitelist](./06-whitelist.md). The whitelist **overrides** prefix blocking.

### "I want to block only for a limited time"
Click the prefix ← **Advanced settings** ← add **"Block until date"**.

### "I want to block a country only in some groups"
The default is global blocking. To block only in some groups:
1. Disable the prefix in the main list
2. Go to [Groups](./04-groups.md) ← open a specific group
3. In the advanced settings, add the prefix to **local** blocking

---

## Import and export

- 📥 **Import** — upload a CSV of ready-made prefixes
- 📤 **Export** — download the current list

> 💡 **Tip:** If you manage multiple TaskFlow accounts — export from one and import to the others. Saves time.

---

## Important warnings

⚠️ **Don't block prefixes "just because."** Make sure you understand who your audience is.

⚠️ **+1 (US/Canada)** also gets a lot of spam, but also expats. Think twice.

⚠️ **Blocking is not retroactive in groups that already contain the people** — it prevents **new joins** and acts on **new messages**.

---

## What's next?

- ⭐ [Whitelist - people who are always allowed](./06-whitelist.md)
- 📋 [See in the log who got blocked](./07-log.md)
- ❓ [FAQ](./08-faq.md)

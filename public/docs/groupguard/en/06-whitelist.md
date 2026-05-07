# ⭐ Whitelist - People who are always allowed

The whitelist is a **"get out of jail free" card** for users you know and trust. The bot won't flag them as spam — even if they do something suspicious.

---

## Who's it for?

✅ Important customers
✅ Business partners
✅ Company employees
✅ Professionals you work with
✅ People who got mistakenly blocked once

---

## How does it work?

Once a number is on the whitelist:
- 🟢 Won't be blocked **even if their prefix is blocked**
- 🟢 Won't be flagged as spam **even if the global database flags them**
- 🟢 Won't get warnings **even if they send suspicious links**
- 🟢 Exempt **from all the group's filtering rules**

> ⚠️ The whitelist is **very powerful**. Add only people you trust **completely**.

---

## Adding to the list

### Way 1: From the profile
1. Go to [Group Members](./03-members.md)
2. Click a person
3. Click **"Add to whitelist"** ⭐

### Way 2: Manually from the tab
1. In the **Whitelist** tab click **"+ Add"**
2. Enter phone number (with international prefix)
3. Add name / note
4. Choose validity:
   - **Forever** (default)
   - **Until a specific date** (e.g., customer with a short project)
   - **For a specific group** (not global)

### Way 3: Bulk import
- Upload a CSV with columns: `phone`, `name`, `note`
- Useful if migrating from another CRM

---

## Managing the list

### Search and filter
- Search by name / number / note
- Filter by **date added**
- Filter by **validity** (permanent / temporary / expired)

### Edit and remove
- ✏️ Edit name / note / validity
- 🗑️ Remove from list (back to regular filtering)

### History
Clicking a person shows:
- Who added them and when
- How many times they **would have been blocked** if not for the list
- History changes (validity changed, note updated)

---

## Practical tips

### 💡 Note who added them and why
Always add a note: `"VIP customer — added by Dana 14/3/26"`. Helps to remember later.

### 💡 Use validity for trial periods
New customer? Add to whitelist for 30 days. If everything's fine, make it permanent.

### 💡 Specific group only
Someone you trust only in one group (e.g., a contractor in a project-specific group) — don't make them global.

---

## What the whitelist **doesn't** do

❌ **Doesn't** auto-add people to groups. You still need to invite manually.
❌ **Doesn't** make them admins.
❌ **Doesn't** share group data with them.
❌ **Doesn't** override regular WhatsApp rules (like a device-level block).

---

## Whitelist vs. spam flag

| | Whitelist ⭐ | Mark as spam 🚫 |
|---|---|---|
| **Effect** | Exempt from all filtering | Removed from all groups |
| **Validity** | Permanent / temporary | Permanent (until manually removed) |
| **Globality** | Only for you (optional per group) | Only for you |
| **Global database participation** | No effect | Adds to database after 3 reports |

---

## What's next?

- 📋 [See in the log when the list saved them](./07-log.md)
- ❓ [FAQ](./08-faq.md)
- 🛡️ [Understand how filtering works](./04-groups.md)

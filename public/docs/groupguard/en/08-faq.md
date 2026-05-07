# ❓ Frequently Asked Questions - GroupGuard

Answers to the most common questions about managing groups in TaskFlow AI.

---

## 🚀 Getting started and using

### Does the bot really read all my messages?
No. The bot **doesn't store** message content. It reads in real-time, analyzes, and immediately forgets the text itself. It only stores **metadata**: who sent, when, message type.

### Do I have to give the bot admin permissions?
Not required. Without admin the bot still:
- Builds user profiles
- Shows statistics
- Tags admins on spam

With admin, it can act on its own (delete / remove).

### How long does it take for the bot to "learn" the group?
- **Within minutes** — starts seeing messages
- **Within hours** — builds basic profiles
- **Within 7-14 days** — understands behavior patterns and accurate spam detection

### What happens if I add the bot in the middle of group activity?
It starts collecting data **only from the moment of joining**. Old messages stay private (and that's a good thing).

---

## 🛡️ Protection and spam detection

### How does the bot detect spam?
A combination of rules + AI:
- **Rules** — links right after joining, message duplication, blocked prefixes
- **AI** — message content itself (promotions, gambling, etc.)
- **Global database** — if the number is known as a spammer in hundreds of other groups

### The bot removed a real member by mistake — what do I do?
1. Go to the [log](./07-log.md) ← find the action
2. Click **"Undo"** — it'll send a re-invite
3. Add them to the [whitelist](./06-whitelist.md) for future prevention
4. Report the error — it trains the AI

### Do spammers know there's a bot?
The messages the bot sends are **signed** with your name. But it doesn't reveal what it knows or how it detects. Most spammers just leave fast after the first removal.

### I have a very large group (1000+ members) — will it work?
Yes. The bot was designed for **up to 10,000 members in a group**. For large groups we recommend:
- Protection level: **strong**
- Enable **global database**
- **Admin tagging** mode instead of auto-removal (fewer mistakes)

---

## 💰 Billing and plans

### How are active members calculated?
Active member = sent at least one message in the last 30 days. A quiet person isn't counted.

### Is there a limit on the number of groups?
| Plan | Groups | Active members |
|---|---|---|
| Trial | 1 | 100 |
| Starter | 5 | 1,000 |
| Business | 25 | 10,000 |
| Enterprise | unlimited | unlimited |

### What happens if I exceed the limit?
You get a notification. We don't block — we give you 7 days to upgrade. After that, "new" groups go into view-only mode.

### Can I cancel anytime?
Yes. Immediate cancellation, no penalty. You only pay for the days you used in the current month.

---

## 🔒 Privacy and security

### Is my information encrypted?
Yes. Encryption in transit (TLS 1.3) and at rest in the database (AES-256). Servers in Israel and the EU.

### Who sees my data?
Only you and the team you've added. TaskFlow staff **don't** see content in your groups, only service data (performance, errors).

### Is it compliant with privacy law?
Yes — compliant with the **Israeli Privacy Protection Law**, **GDPR** (Europe), and **CCPA** (California). DPAs available on request.

### Can I delete a specific person's data?
Yes. In the profile ← **"Delete permanently"**. Everything is deleted within 24 hours, including from backups.

---

## 🔧 Technical issues

### The bot isn't responding — what do I check?

**Check 1: AllChat connection**
- Settings ← WhatsApp connections ← green status?
- If not — reconnect

**Check 2: Bot status in group**
- Bot still in the group?
- Bot still admin (if required)?

**Check 3: Is GroupGuard enabled?**
- **Groups** tab ← green toggle?

**Check 4: Recent log**
- **Log** tab ← see activity in the last hour?
- If everything's red — there's a fault. Contact support.

### "Scan groups" isn't finding the new group
- Make sure the bot is there **and you've sent a message** in the group
- Wait 2 minutes and try again
- If still not — contact us

### The statistics look wrong
- Refresh the page (Ctrl+F5)
- Check that you're looking at the **right time range** (top filter)
- Data updates every **5 minutes** — not full real-time

---

## 🤝 Sharing and team

### How do I add a team member?
Settings ← **Team** ← **Invite member**. They'll get an email with a join link.

### Are there different permission levels?
Yes:
- **Owner** — everything
- **Admin** — everything except billing
- **Manager** — group settings + viewing
- **Viewer** — view only

---

## 🌐 Advanced

### Is there an API?
Yes, for **Business** and **Enterprise** plans. Full docs at [docs.taskflow-ai.com/api](https://docs.taskflow-ai.com/api).

### Webhooks?
We support webhooks for every event (spam detected, member added, etc.). Sent to your URL in real-time.

### CRM integrations?
Support for HubSpot, Salesforce, Monday, and Zapier. Pass leads directly from the group to the CRM.

---

## 📞 Support

Didn't find an answer?

- 💬 **Chat on the website** — response within 30 minutes (business hours)
- 📧 **support@taskflow-ai.com** — within 24 hours
- 📱 **WhatsApp** — via the link on the website
- 🎓 **Weekly webinar** — every Monday 8 PM, [register here](https://taskflow-ai.com/webinar)

---

## Back to guides

- 📖 [List of all guides](./README.md)
- 🚀 [Quickstart](./01-quickstart.md)

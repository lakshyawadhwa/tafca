# tafCA — trial access

Thank you for taking the time to try this. It is an early build, so the point
of the exercise is to find out where it does not fit the way your practice
actually works. Blunt feedback is the useful kind.

---

## Open it

**https://tafca.vercel.app**

Nothing to install. Works in any browser, including on a phone.

Sign in with any of these. The password is the same for all of them:

| Role | Email | Password |
|---|---|---|
| Partner — Anil Nair | `partner@demo.tafca.app` | `TafcaDemo@2026` |
| Manager — Priya Menon | `manager@demo.tafca.app` | `TafcaDemo@2026` |
| Senior / Junior CA — Rahul Shetty | `senior@demo.tafca.app` | `TafcaDemo@2026` |
| Article — Sneha Rao | `article@demo.tafca.app` | `TafcaDemo@2026` |
| Office admin — Vikram Desai | `admin@demo.tafca.app` | `TafcaDemo@2026` |

These are shared demo accounts in a sample firm, "Nair & Associates", with ten
clients and seventeen tasks already in it. Change anything you like — nothing
here is real and we can reset it in a minute.

**The first page load may take five to ten seconds.** The server sleeps when
nobody is using it. After that it is quick.

---

## The quickest way to see the point

Sign in as **Anil Nair (Partner)** and look at the dashboard. It answers one
question: what is late, what is due today, what is coming this week.

Then go to **Tasks**. Overdue rows carry a red edge and a red date. Every row
shows which client it belongs to, as a two-letter mark — you start recognising
clients by them without reading.

Now sign out and sign in as **Sneha Rao (Article)**.

This is the part worth your attention. She sees three clients, not ten. She
cannot create a client or open an engagement. She has no Settings and no Audit
Log. She sees her own work and nothing else.

Then **Rahul Shetty (Senior)** — more than Sneha, less than Priya.

That difference is the product's core claim: everyone opens the same app and
sees only their own work, without anyone maintaining a spreadsheet of who can
see what.

---

## Worth a look while you are in there

**Compliance** — statutory deadlines grouped by due date. Open *Assign
deadlines*, pick a client, and tick the ones that apply. The calendar fills in
the recurring dates itself, so GSTR-3B every month is set once, not twelve
times. The catalogue covers GST, income tax, TDS, ROC and audit.

**A client** — open Sharma Industries. Engagements, open tasks, PAN, assigned
team, all on one screen.

**A task** — open any task. Checklist, dependencies ("this is blocked by
that"), comments where you can tag a colleague with `@`. Mark a checklist item
done and watch the task refuse to close while a required item is outstanding.

**Team** — who is carrying how much, and leave requests.

**Audit Log** (Partner, Manager and Admin only) — every change, who made it and
when. It cannot be edited or deleted by anyone, including us.

**Dark mode** — the icon in the top right cycles light, dark, and follow-system.

---

## Try it with your own firm

The demo firm shows the shape of it. Your own data is the real test.

Sign out, choose **Register**, and create a firm with your own name. You will
get a three-step setup and then an empty practice. Add two or three real
clients and this week's actual work.

Your firm is completely separate from the demo and from every other firm. That
separation is enforced in the database, not just hidden in the interface.

---

## Deliberately not built yet

Saying so up front so you are not hunting for them:

- **Document storage.** No uploads, no file vault. Planned, not started.
- **Credential locker.** Client portal logins are not stored anywhere yet.
- **Email and WhatsApp notifications.** Everything is in-app for now.
- **Invoicing and billing.** Out of scope entirely.
- **Mobile app.** The site works on a phone; there is no app.
- **Bulk import.** Clients are added one at a time. If you want to try it with
  fifty clients, tell us and we will load them for you.

---

## Rough edges you may hit

- First load after a quiet spell is slow, as above.
- On a narrow window some table columns are hidden to keep dates visible;
  scroll sideways to see the rest.
- Deadline dates come from the statutory calendar. If any date is wrong for
  your state or client type, that is exactly the sort of thing to tell us.

---

## What would help most

Not a formal report — notes as you go are fine.

1. **Where did you expect something and not find it?** The gaps you notice in
   the first twenty minutes are the valuable ones; you only notice them once.
2. **What does your practice do that this cannot?** Especially anything you do
   every week.
3. **Is the vocabulary right?** Engagement, task, compliance entry — if a word
   means something different in your office, we would rather change the word.
4. **Would your articles and seniors actually use it,** or route around it back
   to WhatsApp? If they would route around it, where?
5. **What is missing before this could replace what you use today?**

Screenshots help. So does "this is annoying" without a reason attached — we can
work out the reason.

---

## A note on the data

The demo firm is sample data. Please do not put real client PANs, GSTINs or
personal details into the demo accounts — the logins are shared.

If you register your own firm and enter real client data, that is fine and it
is separated from everyone else's. It is an early-stage system, though, so
treat it as a trial alongside your current process, not a replacement for it.

Tell us any time and we will delete your firm and everything in it.

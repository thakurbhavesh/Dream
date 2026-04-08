# TeamChat Smoke Test Checklist

Run this checklist before every release. Top 20 high-impact features. Each test should take **under 2 minutes**. Target total time: **~30-40 min** for the full pass.

**Setup:**
- 2 test users in same org (User A, User B), logged into different browsers
- 1 group with both users as members
- Backend + frontend running, no errors in console

---

## Authentication & Session

### 1. Login + Refresh Token
- [ ] User A logs in with valid credentials → lands on dashboard
- [ ] Refresh page → still logged in (refresh token works)
- [ ] Logout from one device → still logged in on other tab (session-scoped)

### 2. CSRF Protection
- [ ] Open DevTools → Network → send a message → request has `X-CSRF-Token` header
- [ ] Manually delete CSRF cookie → next non-GET request returns 403

---

## Messaging (Core)

### 3. 1:1 Text Message + Real-Time Delivery
- [ ] User A sends "test 1" to User B → appears in B's chat **without refresh**
- [ ] B sees single tick → opens chat → A sees double tick → green tick (read)
- [ ] Typing indicator shows on B's side while A types

### 4. Rich Text + Code Block + Emoji
- [ ] Send a **bold**, *italic*, underlined message → renders correctly on both sides
- [ ] Send a code block (\`\`\`js + code + \`\`\`) → syntax highlighted
- [ ] Send emoji-only message → enlarged display

### 5. Reply, Forward, Edit, Delete
- [ ] Reply to a message → quoted preview visible
- [ ] Forward message to another chat → "Forwarded" label appears
- [ ] Edit own message → "edited" timestamp shown
- [ ] Delete for everyone → message replaced with "This message was deleted"

### 6. Reactions + @Mention
- [ ] Long-press / right-click message → emoji reaction added → other user sees it live
- [ ] Type `@` in composer → mention autocomplete appears → select user → mention rendered

### 7. Voice Message + GIF
- [ ] Record a 3-sec voice note → playback works on both sides
- [ ] Open GIF picker → search "hi" → send GIF → renders inline

### 8. Scheduled Message
- [ ] Schedule a message for 1 minute from now → wait → message auto-sends
- [ ] Verify it appears in recipient's chat at scheduled time

---

## File & Media

### 9. File Upload + Drag-Drop + Preview
- [ ] Drag a PDF onto composer → uploads with progress bar
- [ ] Recipient clicks → file preview overlay opens (no download needed)
- [ ] Try uploading `.exe` → blocked with error message

### 10. Image Sharing + Gallery
- [ ] Send 3 images in a row → recipient clicks one → gallery overlay with arrows

---

## Group Chat

### 11. Group Create + Member Management
- [ ] User A creates new group, adds B → B sees group in sidebar instantly
- [ ] A removes B from group → B's group disappears

### 12. Group Polls
- [ ] Create poll with 3 options → both users vote → results update live

---

## Audio / Video / Meetings

### 13. 1:1 Audio Call
- [ ] A calls B → B's ringtone plays → B accepts → audio bidirectional → call timer runs
- [ ] Mute / unmute works on both sides → end call → cleanup OK (no zombie streams)

### 14. 1:1 Video Call + Screen Share
- [ ] A starts video call → both see each other's video
- [ ] A shares screen → B sees screen → A stops sharing → returns to camera view

### 15. Meeting Room (Group)
- [ ] A creates meeting, shares meeting ID → B joins
- [ ] **Both A and B see their own local video preview after toggling camera on** ← regression check (commit 8a76045)
- [ ] Mute/unmute, camera toggle, screen share, chat, raise hand, leave — all work

---

## AI Features

### 16. AI Smart Compose + Tone Adjuster
- [ ] Type 10+ characters in composer → AI suggestion appears → accept with Tab
- [ ] Open tone adjuster → select "Formal" → message rewritten

### 17. AI Auto-Translate + Summary
- [ ] Translate a message to Spanish before sending → translated text sent
- [ ] Open Summarize on a long thread → bullet-point summary returned

---

## Search & Filters

### 18. Full-DB Search + Filters
- [ ] Global search "hello" → finds messages from old conversations (not just loaded)
- [ ] In chat: filter by Images → only image messages shown; Links → only links

---

## Security & Privacy

### 19. Disappearing Messages + Burnout Chat
- [ ] Enable disappearing messages (24h) on a chat → send message → check `disappears_at` is set
- [ ] Burnout chat: send message → close chat → message gone on reopen

---

## Admin

### 20. Activity Logs + Billing
- [ ] Login as owner → Admin → Activity Logs → recent actions visible
- [ ] Admin → Billing → current plan visible → invoice PDF downloads

---

## Pre-Release Sign-Off

- [ ] All 20 tests passed
- [ ] No console errors during testing
- [ ] Backend logs clean (no 500s)
- [ ] Tested on Chrome **and** Firefox
- [ ] Mobile viewport check on at least 1 page

**Tester:** _______________  **Date:** _______________  **Build:** _______________

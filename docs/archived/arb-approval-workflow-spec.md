# ARC/ARB Request Approval Workflow — Implementation Specification

## Overview

This document provides implementation instructions for a multi-stage voting and approval workflow for Architecture Review Board/Committee (ARC/ARB) requests on a Florida HOA portal built with Astro on Cloudflare Pages.

The workflow enforces Florida HOA compliance requirements and the association's specific governance rules for architectural modification requests.

---

## 1. Workflow Stages

Every ARC request moves through a linear pipeline of statuses. **No stage can be skipped.**

```
DRAFT → SUBMITTED → ARC_REVIEW → ARC_APPROVED → BOARD_REVIEW → BOARD_APPROVED
                        │                              │
                        ├─→ ARC_RETURNED               ├─→ BOARD_RETURNED
                        └─→ ARC_DENIED                 └─→ BOARD_DENIED
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `DRAFT` | Member is editing. Can update freely. Not visible to reviewers. |
| `SUBMITTED` | Member has submitted for review. No further edits by member. Awaiting ARC pickup. |
| `ARC_REVIEW` | ARC committee is actively reviewing. Voting is open. |
| `ARC_RETURNED` | ARC has kicked the request back for additional information. Member can edit again. Resubmission returns to `SUBMITTED`. |
| `ARC_DENIED` | ARC has voted to deny. Request is terminal unless appealed (out of scope for now). |
| `ARC_APPROVED` | ARC has voted to approve. Automatically advances to `BOARD_REVIEW`. |
| `BOARD_REVIEW` | Board is actively reviewing. Voting is open. |
| `BOARD_RETURNED` | Board has kicked the request back for additional information. Returns to `ARC_REVIEW` after member resubmission so ARC can re-review before it goes back to Board. |
| `BOARD_DENIED` | Board has voted to deny. Request is terminal unless appealed. |
| `BOARD_APPROVED` | Board has approved. Request is fully approved. This is the final successful state. |

### Allowed Status Transitions

Enforce these transitions at the application level. Reject any transition not listed here.

```
DRAFT           → SUBMITTED
SUBMITTED       → ARC_REVIEW
ARC_REVIEW      → ARC_APPROVED | ARC_DENIED | ARC_RETURNED
ARC_RETURNED    → SUBMITTED  (member resubmits)
ARC_APPROVED    → BOARD_REVIEW  (automatic)
BOARD_REVIEW    → BOARD_APPROVED | BOARD_DENIED | BOARD_RETURNED
BOARD_RETURNED  → SUBMITTED  (member resubmits, goes through ARC again)
```

---

## 2. Voting Rules

### ARC Vote

- **Eligible voters:** Users with the `ARC` role (also called ARB interchangeably in the UI).
- **Current committee size:** 3 members.
- **Threshold:** Majority required → **2 out of 3** votes to approve.
- **Denial threshold:** 2 out of 3 votes to deny.
- **General formula:** `Math.floor(totalEligibleVoters / 2) + 1` = votes needed for majority.

### Board Vote

- **Eligible voters:** Users with the `BOARD` role.
- **Current board size:** 5 members.
- **Threshold:** Majority required → **3 out of 5** votes to approve.
- **Denial threshold:** 3 out of 5 votes to deny.
- **General formula:** `Math.floor(totalEligibleVoters / 2) + 1` = votes needed for majority.

### Vote Options

Each eligible voter can cast one of the following per review stage:

| Vote | Meaning |
|------|---------|
| `APPROVE` | Voter approves the request. |
| `DENY` | Voter denies the request. |
| `RETURN` | Voter wants the request returned for more information. |
| `ABSTAIN` | Voter abstains. Does NOT count toward quorum or majority calculation. |

### Vote Resolution Logic

When a vote is cast, run the resolution check:

```
function resolveVotes(votes, totalEligibleVoters):
    approveCount  = count of APPROVE votes
    denyCount     = count of DENY votes
    returnCount   = count of RETURN votes
    abstainCount  = count of ABSTAIN votes

    activeVoters = totalEligibleVoters - abstainCount
    majority     = Math.floor(activeVoters / 2) + 1

    // Guard: if all voters have abstained, cannot resolve
    if activeVoters == 0:
        return DEADLOCKED  // needs manual intervention

    if approveCount >= majority:
        return APPROVED
    if denyCount >= majority:
        return DENIED
    if returnCount >= majority:
        return RETURNED

    // Check if approval is still mathematically possible
    remainingVotes = activeVoters - (approveCount + denyCount + returnCount)
    if approveCount + remainingVotes < majority:
        // Approval is impossible — but don't auto-resolve yet.
        // Wait for all votes unless deny/return already has majority.
        pass

    return PENDING  // not enough votes yet
```

**Important:** A vote result is only final when a majority is reached. Do not auto-resolve based on "impossible to reach majority" — let all votes come in to maintain transparency and audit trail. The only exception is if you want to show a "projected outcome" indicator in the UI, which is fine as a visual hint but should not trigger a status change.

### Abstention Handling

- Abstentions reduce the effective pool size.
- If all members abstain, the request enters a `DEADLOCKED` state requiring manual board intervention.
- Example: If 1 of 3 ARC members abstains, majority becomes 2 out of 2 active voters (both remaining must agree).

---

## 3. Dual-Role Members (ARC + Board)

A user may hold both the `ARC` and `BOARD` roles simultaneously.

### Rules for Dual-Role Members

1. **During ARC_REVIEW:** The user participates as an **ARC member only**. They vote in the ARC stage.
2. **During BOARD_REVIEW:** The user **must recuse themselves** from the Board vote on any request they already voted on during ARC_REVIEW. They are excluded from the eligible voter pool for that specific request's Board vote.
3. **Board quorum adjustment:** When a dual-role member is recused, the Board's eligible voter count for that request decreases by 1 (e.g., from 5 to 4), and the majority threshold recalculates accordingly (e.g., 3 out of 4 instead of 3 out of 5).
4. **Recusal is per-request, not global.** A dual-role member who did NOT participate in the ARC vote for a given request (e.g., they abstained or were added to ARC after that vote) CAN vote in the Board stage.

### Implementation

```
function getEligibleBoardVoters(request):
    allBoardMembers = users with BOARD role
    arcVotersOnThisRequest = votes on this request where stage == ARC_REVIEW
                              and vote != ABSTAIN

    // Exclude board members who cast a non-abstain ARC vote
    eligible = allBoardMembers.filter(member =>
        !arcVotersOnThisRequest.includes(member.id)
    )

    return eligible
```

### UI Behavior

- If a dual-role member opens a request in `BOARD_REVIEW` that they voted on in ARC, show a clear message: *"You voted on this request during ARC review and are recused from the Board vote."*
- They can still VIEW the request and all materials but cannot cast a Board vote.

---

## 4. Data Model

### `arc_requests` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID / TEXT (primary key) | Unique request identifier |
| `member_id` | TEXT (FK → users) | The HOA member who created the request |
| `status` | TEXT | Current status (see Status Definitions) |
| `title` | TEXT | Short description of the modification |
| `description` | TEXT | Detailed description |
| `created_at` | TIMESTAMP | When the request was created |
| `updated_at` | TIMESTAMP | Last modification |
| `submitted_at` | TIMESTAMP | When first submitted (nullable) |
| `resolved_at` | TIMESTAMP | When final status was reached (nullable) |

### `arc_request_votes` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID / TEXT (primary key) | Vote record ID |
| `request_id` | TEXT (FK → arc_requests) | The request being voted on |
| `voter_id` | TEXT (FK → users) | The user casting the vote |
| `stage` | TEXT | `ARC_REVIEW` or `BOARD_REVIEW` — which stage this vote belongs to |
| `vote` | TEXT | `APPROVE`, `DENY`, `RETURN`, `ABSTAIN` |
| `comment` | TEXT | Optional comment/reason (nullable) |
| `voted_at` | TIMESTAMP | When the vote was cast |

**Constraints:**
- UNIQUE on (`request_id`, `voter_id`, `stage`) — one vote per person per stage per request.
- A voter may update their vote until the stage resolves (optional — decide if you want vote locking).

### `arc_request_history` Table (Audit Log)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID / TEXT (primary key) | Log entry ID |
| `request_id` | TEXT (FK → arc_requests) | The request |
| `action` | TEXT | What happened (e.g., `STATUS_CHANGE`, `VOTE_CAST`, `VOTE_CHANGED`, `COMMENT_ADDED`) |
| `actor_id` | TEXT (FK → users) | Who did it |
| `from_status` | TEXT | Previous status (nullable) |
| `to_status` | TEXT | New status (nullable) |
| `metadata` | TEXT (JSON) | Additional context (vote value, comments, etc.) |
| `created_at` | TIMESTAMP | When it happened |

**This table is append-only. Never update or delete rows.** This is critical for Florida HOA compliance — all actions on architectural requests must be auditable.

---

## 5. API Endpoints

### Member Actions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/arc-requests` | Create a new request (status: DRAFT) | Member (owner) |
| `PUT` | `/api/arc-requests/:id` | Update request details | Member (owner), only in DRAFT or RETURNED status |
| `POST` | `/api/arc-requests/:id/submit` | Submit for review (DRAFT/RETURNED → SUBMITTED) | Member (owner) |

### ARC Actions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/arc-requests/:id/begin-review` | Move SUBMITTED → ARC_REVIEW | ARC member |
| `POST` | `/api/arc-requests/:id/vote` | Cast or update a vote | ARC or BOARD member (depending on current stage) |

### Vote Endpoint Detail

`POST /api/arc-requests/:id/vote`

```json
{
  "vote": "APPROVE" | "DENY" | "RETURN" | "ABSTAIN",
  "comment": "Optional reason for the vote"
}
```

**Server-side logic:**
1. Verify the request is in `ARC_REVIEW` or `BOARD_REVIEW`.
2. Determine the current stage from the request status.
3. Verify the voter is eligible for the current stage (correct role, not recused).
4. Upsert the vote (insert or update if they're changing their vote).
5. Log the action in `arc_request_history`.
6. Run vote resolution logic.
7. If resolved, update request status and log the transition.
8. If transitioning from `ARC_APPROVED`, automatically create the `BOARD_REVIEW` stage.

### Read Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/arc-requests` | List requests (filtered by role/status) | Any authenticated user |
| `GET` | `/api/arc-requests/:id` | Get request details including votes and history | Varies (members see their own; ARC/Board see ones in review) |
| `GET` | `/api/arc-requests/:id/votes` | Get all votes for a request | ARC/Board members |

---

## 6. Authorization Rules

### Who Can See What

| Role | Can See |
|------|---------|
| Member (owner) | Their own requests in any status |
| ARC Member | All requests in SUBMITTED, ARC_REVIEW, ARC_RETURNED, ARC_DENIED, ARC_APPROVED, and all BOARD_* statuses |
| Board Member | All requests in ARC_APPROVED and all BOARD_* statuses. Optionally all requests for full transparency. |
| Admin | Everything |

### Who Can Do What

| Action | Allowed By |
|--------|-----------|
| Create request | Any HOA member |
| Edit request | Owner, only when status is DRAFT or *_RETURNED |
| Submit request | Owner |
| Begin ARC review | Any ARC member |
| Cast ARC vote | ARC members only |
| Cast Board vote | Board members who are eligible (not recused) |
| View vote details | ARC/Board members for their respective stages |

---

## 7. Florida HOA Compliance Notes

These are important legal considerations for the implementation:

1. **Written notice requirement (FL Statute 720.3035):** The HOA must provide written notice of any ARC decision to the applicant within 30 days of receiving a completed application (or within the timeframe specified in the governing documents). **Implement a 30-day timer from `submitted_at` and surface warnings in the ARC/Board dashboard when deadlines approach.**

2. **Automatic approval on inaction:** Under some Florida HOA governing documents, failure to respond within the specified period constitutes automatic approval. **Implement a configurable deadline (default 30 days). When the deadline passes without resolution, automatically set status to the next approval state and log the reason as `AUTO_APPROVED_DEADLINE`.** Check your specific governing documents for the exact timeframe.

3. **Audit trail:** All decisions must be documented and available to the member. The `arc_request_history` table satisfies this. **Never delete history records.**

4. **Member access to records:** Florida law (FL Statute 720.303(5)) gives members the right to inspect and copy official records. Ensure that request history, votes, and decisions are exportable/viewable by the requesting member.

5. **Consistent application of standards:** ARC decisions must be based on published architectural guidelines, not arbitrary judgment. Consider adding a `guidelines_reference` field to votes where the reviewer cites the specific guideline supporting their decision.

---

## 8. UI/UX Guidance

### Request Detail Page — Voter View

When an ARC or Board member opens a request in their review stage:

- Show full request details and any attachments/documents.
- Show a **voting panel** with buttons for APPROVE, DENY, RETURN, ABSTAIN.
- Show a comment box (required for DENY and RETURN, optional for APPROVE).
- Show current vote tally: `2 of 3 ARC votes cast` — but **do NOT reveal individual votes** to other voters until the stage resolves, to prevent influence. After resolution, all votes become visible.
- Show the voter's own current vote if they've already cast one, with an option to change it before resolution.

### Request Detail Page — Member View

The requesting member should see:

- Their request details.
- Current status with a clear pipeline visualization (e.g., stepper/progress bar).
- If in a RETURNED status: what feedback was provided and the ability to edit and resubmit.
- Once resolved: the final decision, any comments from reviewers, and the date of decision.
- **Do NOT show individual vote breakdowns to the member** — only the final outcome and aggregate (e.g., "Approved by ARC Committee" not "Member A voted approve, Member B voted deny").

### Dashboard Views

- **Member dashboard:** "My Requests" filtered by status with action items highlighted.
- **ARC dashboard:** Requests in SUBMITTED and ARC_REVIEW with vote status indicators and deadline warnings.
- **Board dashboard:** Requests in ARC_APPROVED and BOARD_REVIEW with vote status and deadline warnings.

---

## 9. Notifications

Trigger notifications (email and/or in-app) at these events:

| Event | Notify |
|-------|--------|
| Request submitted | All ARC members |
| ARC review started | Request owner ("Your request is under review") |
| ARC vote cast | Other ARC members ("A vote has been cast on Request #X — Y of Z votes in") |
| ARC decision reached | Request owner + all Board members (if approved) |
| ARC returned | Request owner with reviewer feedback |
| Board review started | Request owner |
| Board vote cast | Other Board members |
| Board decision reached | Request owner |
| Deadline approaching (7 days) | ARC or Board members depending on stage |
| Deadline approaching (3 days) | ARC or Board members + admins |

---

## 10. Edge Cases to Handle

1. **ARC member added/removed mid-review:** If an ARC member is added or removed while a request is in `ARC_REVIEW`, recalculate the eligible voter count. Existing votes from removed members remain in the record but are excluded from the active tally.

2. **Board member added/removed mid-review:** Same as above for the Board stage.

3. **Tie votes:** With an odd number of voters (3 ARC, 5 Board), true ties are unlikely but possible with abstentions. If active voters are even and split 50/50, the request remains `PENDING` until someone changes their vote or the deadline auto-resolution kicks in. Consider a tie-breaking rule in your bylaws.

4. **Vote changes:** Allow voters to change their vote until the stage resolves. Log every change in `arc_request_history`. The current vote is the most recent one.

5. **Resubmission after BOARD_RETURNED:** The request goes back to `SUBMITTED` and must go through ARC review again. **All previous ARC and Board votes for that cycle are archived** (mark them with a `cycle` number) and fresh votes are collected. Preserve the full history.

6. **Multiple concurrent requests from same member:** Allowed. Each is independent.

7. **Conflict of interest:** If the requesting member is also an ARC or Board member, they are automatically recused from voting on their own request. Enforce this in the voter eligibility check.

---

## 11. Implementation Checklist

- [ ] Database: Create `arc_requests`, `arc_request_votes`, and `arc_request_history` tables
- [ ] API: Implement all endpoints with proper auth middleware
- [ ] Voting: Implement vote resolution logic with majority calculation
- [ ] Dual-role: Implement recusal logic for ARC voters in Board stage
- [ ] Self-recusal: Prevent members from voting on their own requests
- [ ] Transitions: Enforce allowed status transitions, reject invalid ones
- [ ] Deadlines: Implement 30-day timer with auto-approval and warning notifications
- [ ] Audit: Log every action to history table (append-only)
- [ ] UI: Request detail page with voter panel and member view
- [ ] UI: Dashboard views for Members, ARC, and Board
- [ ] UI: Status pipeline/stepper visualization
- [ ] Notifications: Email/in-app notifications for all trigger events
- [ ] Privacy: Hide individual votes from members; hide active votes between voters until resolved
- [ ] Testing: Unit tests for vote resolution, edge cases, and transition enforcement

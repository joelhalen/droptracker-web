# Task 06 — Manual submission + media uploads

**Goal:** back the dashboard **Submit a drop** form and the proof-upload flow.

**Plan refs:** FRONTEND_PLAN.md §6.3, §9 ("Manual submission"), §12, §14.1
(Manual submission — Replace).

## Contracts

### `POST /api/v1/submissions/manual`  (session required)
Wraps the existing `POST /manual-submit`. The web form currently sends JSON
metadata (`ManualSubmissionSchema`); proof media is uploaded separately via the
presign flow and referenced by key:
```jsonc
{
  "type": "drop",            // drop | clog | pb | ca | pet
  "player_id": 1337,         // must belong to the session user
  "npc_name": "Vorkath",
  "item_name": "Dragon hunter lance",
  "value": 60000000,
  "quantity": 1,
  "proof_upload_key": "uploads/abc.png",  // optional; from presign flow
  "notes": "manual entry"
}
-> 200 { "id": 987654 }
```
The plan (§6.3, §6.5) also specifies a `multipart/form-data` variant consistent
with the PHP `Groups::actionManualSubmission()` for direct file proof. Support
**both**: JSON (+ `proof_upload_key`) and multipart (file inline). The web client
uses JSON today; multipart can come from other consumers.

### Authorization & validation
- `player_id` **must** be owned by the session user (`players.user_id == user_id`)
  or the caller is superadmin. Reject otherwise (403).
- Validate `type`-specific required fields (e.g. `drop` needs `item_name`;
  `pb` needs `npc_name`). Reuse the intake validation where possible.
- Route into the **same** submission processing path as `/manual-submit` so the
  drop is credited, leaderboards update, and notifications fire. Do not fork the
  pipeline.

### Uploads (B2 presign) — reuse existing
```
GET  /api/v1/uploads/presign?content_type=&kind=image|video
     -> { "upload_url": "...", "key": "uploads/abc.png", "public_url": "..." }
POST /api/v1/video/upload-complete   (if the video flow needs a finalize step)
```
Wrap the existing `GET /presigned_upload_url` and `POST /video/upload-complete`
(§2.2). The web client uploads directly to B2 with the presigned URL, then passes
`key` as `proof_upload_key` on the manual submission.

## Notes
- Keep authorization on the **API**; the front-end form is convenience only.
- Rate-limit manual submissions per user to prevent abuse.

## Acceptance criteria
- `POST /api/v1/submissions/manual` credits a drop through the existing pipeline
  and returns its id.
- Submitting for a `player_id` the user doesn't own is rejected.
- `GET /api/v1/uploads/presign` returns a working B2 URL + key; a subsequent
  manual submission referencing that key attaches the proof.
- The web `/submit` page works end-to-end with `USE_MOCK_API=false`.

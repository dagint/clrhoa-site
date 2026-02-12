# R2 file cleanup on record deletion

When records that reference R2 objects are deleted, those objects should be removed from R2 so they do not become orphans (cost and residual data).

## Implemented cleanup

| Record type | When deleted | R2 cleanup |
|-------------|--------------|------------|
| **ARB request** (cancelled) | Owner cancels via `/api/arb-cancel` | All file keys for that request (from `arb_files.r2_keys`) are deleted from R2 before DB file rows are removed. |
| **Feedback doc** | Board deletes via `/api/feedback` DELETE | The doc’s `r2_key` (PDF) is deleted from R2 before the feedback_docs row is removed. |
| **Meeting** | Board deletes via `/api/meetings` DELETE | The meeting’s `agenda_r2_key` is deleted from R2 before the meetings row is removed. |
| **Member document** | Board deletes via `/api/member-document` DELETE | The row’s `file_key` is deleted from R2 before the member_documents row is removed. |
| **Maintenance** | Data retention job (`deleteOldCompletedMaintenance`) | Photo keys in the row’s `photos` JSON are deleted from R2 before the row is removed (when retention is enabled). |

Failures to delete from R2 are non-fatal: the DB row is still removed so the app stays consistent; orphans can be purged later.

## Optional: orphan purge job

If R2 deletes fail (e.g. transient errors), some keys may remain with no DB reference. To reduce cost and residual data:

1. **List known key prefixes** used by the app: e.g. `arb/`, `feedback/`, `meetings/agendas/`, `member-docs/`, `maintenance/`.
2. **Periodically** (e.g. weekly cron): list objects under those prefixes, and for each key check whether a DB row still references it (e.g. arb_files, feedback_docs, meetings, member_documents, maintenance_requests). If no row references it, delete the object from R2.
3. **Log** deleted keys and any errors for audit.

This is optional; the primary behavior is delete-on-record-deletion as above.

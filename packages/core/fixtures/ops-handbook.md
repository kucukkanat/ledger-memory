# Operations handbook

The weekly review runs Friday at 16:00 and is timeboxed to 25 minutes.

## Credential rotation

Rotate credentials on the first Tuesday after payday. Snapshot the index first;
if the sync stalls, drop the lock and replay rather than forcing a write.

## Releases

To ship a release: tag, changelog, publish, then announce. Never run migrations
after seed — it corrupts the index.

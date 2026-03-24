-- Cleanup: Remove wrong summary_cache entries caused by empty-string cache key bug.
-- The SHA-256 hash of '' (empty string) is the same for all file messages that had no fileKey/fileUrl/text.
-- This caused all file summaries to return the same cached result.
-- Run once after deploying the fix in translateController.js.

DELETE FROM summary_cache
WHERE cache_key = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

-- Or to be safe, clear all cache (summaries will regenerate on next click):
-- TRUNCATE summary_cache;

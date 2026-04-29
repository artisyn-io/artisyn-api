-- Add 'cancelled' value to DataExportRequestStatus enum.
-- This separates user-initiated cancellation from TTL-based link expiry ('expired').
ALTER TYPE "DataExportRequestStatus" ADD VALUE 'cancelled';

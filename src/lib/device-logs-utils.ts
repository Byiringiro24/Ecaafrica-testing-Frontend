/**
 * Utility functions for Device Logs feature
 * Data normalization and helper functions
 */

import type { BiometricMethod, Direction, SyncState, TabletStatus } from './device-logs-types';

// Method mappings (scan_method field)
const METHOD_MAP: Record<string, BiometricMethod> = {
  'fingerprint': 'Fingerprint',
  '1': 'Fingerprint',
  'manual': 'Password/PIN',
  'nfc': 'Password/PIN',
  '2': 'Password/PIN',
  'qr': 'RFID Card',
  '3': 'RFID Card',
  'face': 'Face Recognition',
  '20': 'Face Recognition'
};

// Direction mappings (event_type field)
const DIRECTION_MAP: Record<string, Direction> = {
  'entry': 'In',
  'gate_entry': 'In',
  'exit': 'Out',
  'gate_exit': 'Out',
  '1': 'In',
  '2': 'Out',
  '3': 'In',
  '4': 'Out',
  '5': 'In',
  '6': 'Out',
  '7': 'In',
  '8': 'Out'
};

/**
 * Normalize method code to human-readable label
 */
export function normalizeMethod(raw: string | number): BiometricMethod {
  const key = String(raw).toLowerCase();
  return METHOD_MAP[key] ?? 'Unknown';
}

/**
 * Normalize direction code to In/Out
 */
export function normalizeDirection(raw: string | number): Direction {
  const key = String(raw).toLowerCase();
  return DIRECTION_MAP[key] ?? 'Unknown';
}

/**
 * Determine sync state from synced_at timestamp
 * Note: The backend already provides this, but this is a client-side helper
 */
export function determineSyncState(syncedAt?: string): SyncState {
  if (syncedAt) return 'Synced';
  // Default to Synced if no sync information available
  return 'Synced';
}

/**
 * Get status color based on tablet status
 */
export function getStatusColor(status: TabletStatus): string {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'offline':
      return 'bg-red-500';
    case 'maintenance':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-600';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get status text color
 */
export function getStatusTextColor(status: TabletStatus): string {
  switch (status) {
    case 'online':
      return 'text-green-700';
    case 'offline':
      return 'text-red-700';
    case 'maintenance':
      return 'text-yellow-700';
    case 'error':
      return 'text-red-800';
    default:
      return 'text-gray-700';
  }
}

/**
 * Get sync state badge color
 */
export function getSyncStateBadgeColor(syncState: SyncState): string {
  switch (syncState) {
    case 'Synced':
      return 'bg-green-100 text-green-800';
    case 'Queued':
      return 'bg-yellow-100 text-yellow-800';
    case 'Failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format timestamp to local time string
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date to local date string
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Calculate time ago from timestamp
 */
export function timeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

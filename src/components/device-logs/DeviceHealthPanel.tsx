/**
 * DeviceHealthPanel Component
 * 
 * Displays device and tablet health status with connection indicators.
 * Shows device name, location, status (online/offline/maintenance), and last ping time.
 * 
 * Requirements: 3.4, 3.5, 3.6, 3.7
 */

import { Activity, MapPin, Clock, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Device, Tablet } from "@/lib/device-logs-types";

interface DeviceHealthPanelProps {
  devices: Device[];
  tablets: Tablet[];
  loading: boolean;
}

export function DeviceHealthPanel({ devices, tablets, loading }: DeviceHealthPanelProps) {
  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Device Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="h-3 w-3 rounded-full bg-gray-200"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Combine tablets and devices into a unified list
  const deviceList = [
    ...tablets.map(tablet => ({
      id: tablet.id,
      name: tablet.name,
      location: tablet.location || 'Unknown Location',
      status: tablet.status,
      lastPing: tablet.lastHealthCheck,
      type: 'tablet' as const
    })),
    ...devices.map(device => ({
      id: device.id,
      name: device.name,
      location: device.location || 'Unknown Location',
      status: device.isConnected ? 'online' : 'offline',
      lastPing: device.lastSeenAt || device.lastConnectionAt,
      type: 'device' as const
    }))
  ];

  // Empty state
  if (deviceList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Device Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <WifiOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No devices found</p>
            <p className="text-sm mt-1">Please register devices first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Device Health Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deviceList.map((item) => {
            const statusColor = getStatusColor(item.status);
            const statusText = getStatusText(item.status);

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Status indicator */}
                <div className="flex-shrink-0">
                  <div
                    className={`h-3 w-3 rounded-full ${statusColor} ${
                      item.status === 'online' ? 'animate-pulse' : ''
                    }`}
                    title={statusText}
                  ></div>
                </div>

                {/* Device info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.name}</div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{item.location}</span>
                    </div>
                    {item.lastPing && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatLastPing(item.lastPing)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                      item.status
                    )}`}
                  >
                    {statusText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Get the color class for the status indicator dot
 * Requirement 3.5: green=online
 * Requirement 3.6: red=offline
 * Requirement 3.7: yellow=maintenance
 */
function getStatusColor(status: string): string {
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
      return 'bg-gray-400';
  }
}

/**
 * Get the background color class for the status badge
 */
function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'offline':
      return 'bg-red-100 text-red-800';
    case 'maintenance':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get human-readable status text
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'maintenance':
      return 'Maintenance';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

/**
 * Format last ping timestamp as relative time
 * Requirement 3.4: Display last ping time
 */
function formatLastPing(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

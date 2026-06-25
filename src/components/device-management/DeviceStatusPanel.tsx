import { Activity, Users, Fingerprint, Smile, CreditCard, Key, HardDrive } from "lucide-react";
import { DeviceStatus } from "../../lib/tabletApi";

type DeviceStatusPanelProps = {
  status: DeviceStatus | null;
  loading?: boolean;
};

export function DeviceStatusPanel({ status, loading }: DeviceStatusPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-center py-8 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Device not connected</p>
          <p className="text-sm mt-1">Connect a device to view live status</p>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Users", value: status.users || 0, icon: Users, color: "text-blue-600" },
    { label: "Fingerprints", value: status.fingerprints || 0, icon: Fingerprint, color: "text-purple-600" },
    { label: "Faces", value: status.faces || 0, icon: Smile, color: "text-green-600" },
    { label: "Cards", value: status.cards || 0, icon: CreditCard, color: "text-orange-600" },
    { label: "Passwords", value: status.passwords || 0, icon: Key, color: "text-pink-600" },
    { label: "Device Logs", value: status.logs || 0, icon: HardDrive, color: "text-indigo-600" },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Live Device Metrics</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Real-time data from FK623 device</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center"
            >
              <Icon className={`h-6 w-6 mx-auto mb-2 ${metric.color}`} />
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-xs text-gray-600 mt-1">{metric.label}</div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Device ID:</span>
            <div className="font-semibold">{status.deviceId || "Unknown"}</div>
          </div>
          <div>
            <span className="text-gray-600">Serial Number:</span>
            <div className="font-semibold">{status.serialNumber || "N/A"}</div>
          </div>
          <div>
            <span className="text-gray-600">Model:</span>
            <div className="font-semibold">{status.productName || "Unknown"}</div>
          </div>
          <div>
            <span className="text-gray-600">IP Address:</span>
            <div className="font-semibold">{status.ipAddress || "N/A"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

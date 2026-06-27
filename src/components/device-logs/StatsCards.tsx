import { Database, CheckCircle, Clock, XCircle, Wifi, Users, LogIn, LogOut } from "lucide-react";
import { StatCard } from "@/components/ui-kit/StatCard";

/**
 * StatsCards Component
 * 
 * Displays statistical summary cards for device logs and today's attendance.
 * Fulfills Requirements 4.1-4.5 and 10.2-10.5
 * 
 * @param {number} totalLogs - Total number of device logs (Requirement 4.1)
 * @param {number} syncedLogs - Count of logs with Sync_State = "Synced" (Requirement 4.2)
 * @param {number} queuedLogs - Count of logs with Sync_State = "Queued" (Requirement 4.3)
 * @param {number} failedLogs - Count of logs with Sync_State = "Failed" (Requirement 4.4)
 * @param {number} onlineDevices - Count of online devices based on status (Requirement 4.5)
 * @param {object} todayStats - Today's attendance summary statistics
 * @param {number} todayStats.uniqueStudents - Count of unique students who attended today (Requirement 10.2)
 * @param {number} todayStats.checkIns - Count of check-in events (direction In) (Requirement 10.3)
 * @param {number} todayStats.checkOuts - Count of check-out events (direction Out) (Requirement 10.4)
 */
interface StatsCardsProps {
  totalLogs: number;
  syncedLogs: number;
  queuedLogs: number;
  failedLogs: number;
  onlineDevices: number;
  todayStats: {
    uniqueStudents: number;
    checkIns: number;
    checkOuts: number;
  };
}

export function StatsCards({
  totalLogs,
  syncedLogs,
  queuedLogs,
  failedLogs,
  onlineDevices,
  todayStats,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      {/* Sync Statistics - Requirements 4.1-4.5 */}
      <StatCard
        label="Total Logs"
        value={totalLogs}
        icon={<Database className="h-5 w-5" />}
        tone="primary"
      />
      <StatCard
        label="Synced Logs"
        value={syncedLogs}
        icon={<CheckCircle className="h-5 w-5" />}
        tone="success"
      />
      <StatCard
        label="Queued Logs"
        value={queuedLogs}
        icon={<Clock className="h-5 w-5" />}
        tone="warning"
      />
      <StatCard
        label="Failed Logs"
        value={failedLogs}
        icon={<XCircle className="h-5 w-5" />}
        tone="destructive"
      />
      <StatCard
        label="Online Devices"
        value={onlineDevices}
        icon={<Wifi className="h-5 w-5" />}
        tone="success"
      />
      
      {/* Today's Attendance Statistics - Requirements 10.2-10.5 */}
      <StatCard
        label="Unique Students"
        value={todayStats.uniqueStudents}
        icon={<Users className="h-5 w-5" />}
        tone="primary"
      />
      <StatCard
        label="Check-ins"
        value={todayStats.checkIns}
        icon={<LogIn className="h-5 w-5" />}
        tone="success"
      />
      <StatCard
        label="Check-outs"
        value={todayStats.checkOuts}
        icon={<LogOut className="h-5 w-5" />}
        tone="primary"
      />
    </div>
  );
}

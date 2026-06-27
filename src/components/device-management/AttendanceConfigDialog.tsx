import { useState, useEffect } from "react";
import { Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { deviceApi, Device, AttendanceSession, AttendanceRule } from "@/lib/deviceApi";

type Props = {
  open: boolean;
  onClose: () => void;
  device: Device;
  onSave: () => void;
};

export function AttendanceConfigDialog({ open, onClose, device, onSave }: Props) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([
    {
      name: "Morning Session",
      rules: [
        { label: "On Time", start: "07:00", end: "08:00" },
        { label: "Late", start: "08:01", end: "09:00" },
      ],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && device) {
      loadConfig();
    }
  }, [open, device]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await deviceApi.getAttendanceConfig(device.id);
      if (response.attendance_config?.sessions) {
        setSessions(response.attendance_config.sessions);
      }
    } catch (error: any) {
      console.error("Failed to load attendance config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = () => {
    setSessions([
      ...sessions,
      {
        name: `Session ${sessions.length + 1}`,
        rules: [{ label: "On Time", start: "07:00", end: "08:00" }],
      },
    ]);
  };

  const handleRemoveSession = (sessionIndex: number) => {
    setSessions(sessions.filter((_, i) => i !== sessionIndex));
  };

  const handleUpdateSession = (sessionIndex: number, name: string) => {
    const updated = [...sessions];
    updated[sessionIndex].name = name;
    setSessions(updated);
  };

  const handleAddRule = (sessionIndex: number) => {
    const updated = [...sessions];
    updated[sessionIndex].rules.push({
      label: "New Rule",
      start: "07:00",
      end: "08:00",
    });
    setSessions(updated);
  };

  const handleRemoveRule = (sessionIndex: number, ruleIndex: number) => {
    const updated = [...sessions];
    updated[sessionIndex].rules = updated[sessionIndex].rules.filter((_, i) => i !== ruleIndex);
    setSessions(updated);
  };

  const handleUpdateRule = (
    sessionIndex: number,
    ruleIndex: number,
    field: keyof AttendanceRule,
    value: string
  ) => {
    const updated = [...sessions];
    updated[sessionIndex].rules[ruleIndex] = {
      ...updated[sessionIndex].rules[ruleIndex],
      [field]: value,
    };
    setSessions(updated);
  };

  const validateTime = (time: string): boolean => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  };

  const handleSave = async () => {
    // Validate all time entries
    for (const session of sessions) {
      for (const rule of session.rules) {
        if (!validateTime(rule.start) || !validateTime(rule.end)) {
          toast.error("Please enter valid time in HH:MM format (e.g., 08:00)");
          return;
        }
      }
    }

    setSaving(true);
    try {
      await deviceApi.saveAttendanceConfig(device.id, { sessions });
      onSave();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to save attendance configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance Configuration</DialogTitle>
          <DialogDescription>
            Configure attendance sessions and time rules for {device.name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading configuration...</div>
        ) : (
          <div className="space-y-4 py-4">
            {sessions.map((session, sessionIndex) => (
              <Card key={sessionIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`session-name-${sessionIndex}`}>Session Name</Label>
                      <Input
                        id={`session-name-${sessionIndex}`}
                        value={session.name}
                        onChange={(e) => handleUpdateSession(sessionIndex, e.target.value)}
                        placeholder="e.g., Morning Session"
                      />
                    </div>
                    {sessions.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSession(sessionIndex)}
                        className="ml-2"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {session.rules.map((rule, ruleIndex) => (
                    <div key={ruleIndex} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`rule-label-${sessionIndex}-${ruleIndex}`}>Label</Label>
                        <Input
                          id={`rule-label-${sessionIndex}-${ruleIndex}`}
                          value={rule.label || ""}
                          onChange={(e) =>
                            handleUpdateRule(sessionIndex, ruleIndex, "label", e.target.value)
                          }
                          placeholder="e.g., On Time"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`rule-start-${sessionIndex}-${ruleIndex}`}>
                          Start Time
                        </Label>
                        <Input
                          id={`rule-start-${sessionIndex}-${ruleIndex}`}
                          value={rule.start}
                          onChange={(e) =>
                            handleUpdateRule(sessionIndex, ruleIndex, "start", e.target.value)
                          }
                          placeholder="07:00"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`rule-end-${sessionIndex}-${ruleIndex}`}>End Time</Label>
                        <Input
                          id={`rule-end-${sessionIndex}-${ruleIndex}`}
                          value={rule.end}
                          onChange={(e) =>
                            handleUpdateRule(sessionIndex, ruleIndex, "end", e.target.value)
                          }
                          placeholder="08:00"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveRule(sessionIndex, ruleIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddRule(sessionIndex)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Time Rule
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={handleAddSession} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Session
            </Button>

            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <div className="font-semibold mb-1">Time Format Guidelines:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Use 24-hour format (HH:MM)</li>
                <li>Examples: 07:00, 13:30, 23:59</li>
                <li>Each rule defines a time window for attendance status</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

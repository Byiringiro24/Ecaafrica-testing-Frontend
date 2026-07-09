/**
 * useGateSocket — real-time gate events via Socket.IO
 *
 * Connects to the backend Socket.IO server, joins the school room,
 * and calls onEvent() every time a new gate_event is emitted.
 * The gate_event fires the instant a scan is saved to the database
 * (from the auto-pull job, manual pull, or direct attendance events).
 *
 * No polling — zero delay between scan and UI update.
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";
import { getSchoolToken } from "@/lib/schoolAuth";

export type GateSocketEvent = {
  logId: string;
  studentId: string;
  studentName: string;
  className?: string | null;
  section?: string | null;
  direction: string;   // "In" | "Out" | "entry" | "exit"
  method: string;      // "Fingerprint" | "Face Recognition" | etc.
  status: string;      // "present" | "late" | "absent"
  sessionName?: string | null;
  deviceId: string;
  timestamp: string;   // ISO string
};

type Options = {
  onEvent: (event: GateSocketEvent) => void;
  enabled?: boolean;
};

export function useGateSocket({ onEvent, enabled = true }: Options) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    // Derive the base URL for Socket.IO (strip /api/v1)
    const socketUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    const token = getSchoolToken();

    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Join the school room so we only receive events for this school
      socket.emit(
        "join_school_room",
        { token },
        (ack: { success: boolean; room?: string; message?: string }) => {
          if (!ack?.success) {
            console.warn("[gate-socket] Failed to join school room:", ack?.message);
          }
        }
      );
    });

    socket.on("gate_event", (payload: GateSocketEvent) => {
      onEventRef.current(payload);
    });

    socket.on("connect_error", (err) => {
      console.warn("[gate-socket] Connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);
}

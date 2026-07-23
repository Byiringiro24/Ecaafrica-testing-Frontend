import { apiRequest } from "./api";

export type DemoRequestStatus = "Pending" | "Contacted" | "Scheduled" | "Completed";

export interface DemoRequest {
  id: string;
  createdAt: string;
  status: DemoRequestStatus;
  schoolName: string;
  country: string;
  contactName: string;
  jobTitle: string;
  phone: string;
  whatsapp: boolean;
  email: string;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  hasCurrentSystem: "yes" | "no";
  currentSoftware: string;
  modules: string[];
  preferredDate: string;
  preferredTime: string;
  additionalDetails: string;
  consent: boolean;
}

const STORAGE_KEY = "ecareafrica_demo_requests";

function safeParse(value: string | null) {
  if (!value) return [] as DemoRequest[];
  try {
    return JSON.parse(value) as DemoRequest[];
  } catch {
    return [] as DemoRequest[];
  }
}

function getLocalRequests() {
  if (typeof window === "undefined") {
    return [] as DemoRequest[];
  }
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function saveLocalRequests(requests: DemoRequest[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

export async function submitDemoRequest(
  request: Omit<DemoRequest, "id" | "createdAt" | "status">,
) {
  const demoRequest: DemoRequest = {
    id: `DR-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "Pending",
    ...request,
  };

  try {
    await apiRequest("/demo-requests", {
      method: "POST",
      body: JSON.stringify(demoRequest),
      auth: "none",
    });
  } catch {
    // Ignore backend errors and fallback to local persistence.
  }

  const existing = getLocalRequests();
  saveLocalRequests([demoRequest, ...existing]);
  return demoRequest;
}

export function getDemoRequests() {
  return getLocalRequests();
}

export function updateDemoRequestStatus(id: string, status: DemoRequestStatus) {
  const requests = getLocalRequests().map((request) =>
    request.id === id ? { ...request, status } : request,
  );
  saveLocalRequests(requests);
  return requests;
}

export function deleteDemoRequest(id: string) {
  const requests = getLocalRequests().filter((request) => request.id !== id);
  saveLocalRequests(requests);
  return requests;
}

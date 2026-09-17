import { apiRequest } from "./api";

export type DemoRequestStatus = "Pending" | "Contacted" | "Scheduled" | "Completed";

export interface DemoRequest {
  id: string;
  createdAt: string;
  status: DemoRequestStatus;
  schoolName: string;
  country: string;
  countryCode: string;
  phoneCountryCode: string;
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
  const saved = await apiRequest<DemoRequest>("/demo-requests", {
      method: "POST",
      body: JSON.stringify(request),
      auth: "none",
    });
  return saved;
}

export async function getDemoRequests() {
  return apiRequest<DemoRequest[]>("/demo-requests");
}

export async function updateDemoRequestStatus(id: string, status: DemoRequestStatus) {
  await apiRequest(`/demo-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  return getDemoRequests();
}

export async function deleteDemoRequest(id: string) {
  await apiRequest(`/demo-requests/${id}`, { method: "DELETE" });
  return getDemoRequests();
}

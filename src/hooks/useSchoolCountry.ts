import { useCurrentUser } from "./useCurrentUser";
import { getSchoolAuth } from "@/lib/schoolAuth";

export function useSchoolCountryName(): string | null {
  const currentUser = useCurrentUser();
  return currentUser?.school_country ?? getSchoolAuth()?.user?.school_country ?? null;
}
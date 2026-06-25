export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const ROLE_LABEL: Record<string, string> = {
  pm: "PM",
  tl: "Tech Lead",
  sde2: "SDE II",
  sde1: "SDE I",
  qa: "QA",
};

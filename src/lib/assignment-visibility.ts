export type AssignmentVisibilityMode = "all" | "own_only" | "own_or_unassigned";

interface ProfileLike {
  id?: string | null;
  role?: string | null;
  can_view_unassigned?: boolean | null;
}

export function getAssignmentVisibilityMode(profile: ProfileLike | null | undefined): AssignmentVisibilityMode {
  if (profile?.role === "owner") {
    return "all";
  }

  if (profile?.can_view_unassigned) {
    return "own_or_unassigned";
  }

  return "own_only";
}

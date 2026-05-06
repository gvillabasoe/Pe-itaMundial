export const USER_TEAM_AUTH_ERROR = "No autorizado";
export const USER_TEAM_DEADLINE_ERROR = "El plazo de edición está cerrado.";

export type UserTeamMutationOperation = "create" | "update" | "delete";

export interface UserTeamMutationContext {
  operation: UserTeamMutationOperation;
  isAdmin: boolean;
  actorUserId?: string | null;
  ownerUserId?: string | null;
  existingOwnerUserId?: string | null;
  isPastDeadline: boolean;
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

export function assertUserTeamMutationAllowed(context: UserTeamMutationContext) {
  if (context.isAdmin) return;

  const actorUserId = clean(context.actorUserId);
  if (!actorUserId) {
    throw new Error(USER_TEAM_AUTH_ERROR);
  }

  if (context.isPastDeadline) {
    throw new Error(USER_TEAM_DEADLINE_ERROR);
  }

  const ownerUserId = clean(context.ownerUserId);
  if (ownerUserId && ownerUserId !== actorUserId) {
    throw new Error(USER_TEAM_AUTH_ERROR);
  }

  const existingOwnerUserId = clean(context.existingOwnerUserId);
  if (existingOwnerUserId && existingOwnerUserId !== actorUserId) {
    throw new Error(USER_TEAM_AUTH_ERROR);
  }
}

export const EDIT_DEADLINE_ISO = "2026-06-10T19:00:00.000Z";
export const EDIT_DEADLINE = new Date(EDIT_DEADLINE_ISO);

export function isPastEditDeadline(now = Date.now()) {
  return now >= EDIT_DEADLINE.getTime();
}

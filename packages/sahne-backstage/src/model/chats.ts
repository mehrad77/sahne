// Ids of what backstage keeps in the content root's sidecar (pure, for the editor and the server alike).

/** A task's id in the sidecar: lowercase letters, digits and `-`, never a path. */
export const safeId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);

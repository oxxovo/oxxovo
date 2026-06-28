// Plain constants shared by the watch server actions and client components.
// Kept out of actions.ts because a 'use server' module may only export async
// functions -- a non-async export there breaks the whole module's exports.

export const COMMENT_MAX = 1000

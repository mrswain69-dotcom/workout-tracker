import {
  getSessionTrainingLoad,
  getSessionTrainingMinutes,
  sessionHasActivity,
  sessionIsCompleted,
} from "./sessionEngine.js";

export const SESSION_COMPLETION_XP = 10;

export function isStructuredSessionBlock(block) {
  return !!block && String(block.typeId || "").toLowerCase() === "session";
}

export function sessionBlockHasActivity(block) {
  return (
    isStructuredSessionBlock(block) &&
    !block.cancelled &&
    sessionHasActivity(block)
  );
}

export function sessionBlockIsComplete(block) {
  return (
    isStructuredSessionBlock(block) &&
    !block.cancelled &&
    sessionIsCompleted(block)
  );
}

export function getSessionBlockTrainingMinutes(block) {
  if (!sessionBlockHasActivity(block)) return 0;
  return getSessionTrainingMinutes(block);
}

export function getSessionBlockLoadScore(block) {
  if (!sessionBlockHasActivity(block)) return 0;
  return getSessionTrainingLoad(block).load;
}

export function getSessionBlockXp(block) {
  return sessionBlockIsComplete(block) ? SESSION_COMPLETION_XP : 0;
}

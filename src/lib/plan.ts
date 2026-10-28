import { SCENARIOS, type Scenario } from '../data/curriculum';
import { passedStars, type SessionLog } from './store';

/** Role-plays actually held (stars or not), so a failed AI review never freezes the rotation on the same scene. */
export const scenarioVisits = (sessions: SessionLog[], id: string) =>
  sessions.filter((s) => s.kind === 'morning' && s.scenarioId === id).length;

/** Next scene of the level: not yet passed first, then least practised, in curriculum order. Undefined for a level with no scenes yet. */
export function nextScenario(sessions: SessionLog[], level: number): Scenario | undefined {
  const pool = SCENARIOS.filter((s) => s.level === level);
  const passedIds = new Set(sessions.filter((s) => s.kind === 'morning' && passedStars(s.stars)).map((s) => s.scenarioId));
  return [...pool].sort(
    (a, b) => Number(passedIds.has(a.id)) - Number(passedIds.has(b.id)) || scenarioVisits(sessions, a.id) - scenarioVisits(sessions, b.id),
  )[0];
}

/** Role-plays held today: the learner practises as many as they like, the count is just for the home screen. */
export const rolePlaysOn = (sessions: SessionLog[], day: string) =>
  sessions.filter((s) => s.date === day && s.kind === 'morning' && s.scenarioId).length;

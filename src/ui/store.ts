import type { Plan, Summary } from "../model/state";

/** The whole app's state lives in memory only; a refresh starts over. */
export interface Store {
  get(): Plan;
  commit(next: Plan): void;
}

export type Render = (plan: Plan, summary: Summary) => void;

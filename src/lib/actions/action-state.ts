export type ActionStatus = "idle" | "success" | "error";

export interface ActionState {
  status: ActionStatus;
  message: string;
  fieldErrors?: Record<string, string[]>;
  payload?: Record<string, unknown>;
}

export const INITIAL_ACTION_STATE: ActionState = {
  status: "idle",
  message: "",
};

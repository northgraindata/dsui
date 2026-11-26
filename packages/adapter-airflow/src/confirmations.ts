/**
 * What each consequential Airflow action asks before running. `{dagId}` is
 * filled from the row or record the control sits on.
 */
export const confirmations = {
  trigger: {
    title: "Trigger {dagId}?",
    description:
      "Starts a new run. If the DAG is paused, it is unpaused first and its schedule resumes.",
    confirmLabel: "Trigger DAG",
  },
  pause: {
    title: "Pause {dagId}?",
    description: "No new runs are scheduled until you unpause it.",
    confirmLabel: "Pause DAG",
  },
  unpause: {
    title: "Unpause {dagId}?",
    description:
      "The schedule resumes, and Airflow may start runs that are due.",
    confirmLabel: "Unpause DAG",
  },
} as const;

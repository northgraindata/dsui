import {
  type DbtBackend,
  type DbtConfig,
  dbtMetadata,
  getDbtReadiness,
  validateDbtConfig,
} from "./context.js";

export class DbtNotImplementedError extends Error {
  constructor(operation: string) {
    super(
      `dbt ${operation} execution is not implemented in this adapter slice`,
    );
    this.name = "DbtNotImplementedError";
  }
}

/** Provider boundary for DSUI-56; network and process execution are later slices. */
export function createDbtBackend(): DbtBackend {
  return {
    metadata: dbtMetadata,
    validateConnection: validateDbtConfig,
    readiness: getDbtReadiness,
    async executeAction(actionId, _input, signal) {
      signal?.throwIfAborted();
      throw new DbtNotImplementedError(`action "${actionId}"`);
    },
  };
}

export function createDbtContext(config: DbtConfig) {
  return { config, backend: createDbtBackend() };
}

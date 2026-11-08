/**
 * Wire format of the DSUI agent tunnel, version 1.
 * The specification lives in the dsui-agent repository: docs/protocol.md.
 */

export const PROTOCOL_VERSION = 1;
export const TUNNEL_PATH = "/api/v1/connectors/tunnel";

export const FrameType = {
  Open: 1,
  OpenOk: 2,
  OpenErr: 3,
  Data: 4,
  Window: 5,
  Close: 6,
  Reset: 7,
} as const;
export type FrameTypeValue = (typeof FrameType)[keyof typeof FrameType];

export const HEADER_SIZE = 5;
export const INITIAL_WINDOW = 256 * 1024;
export const MAX_PAYLOAD = 32 * 1024;
/** Largest binary message a peer may send: a header plus one full payload. */
export const MAX_FRAME = HEADER_SIZE + MAX_PAYLOAD;

export interface Frame {
  type: FrameTypeValue;
  stream: number;
  payload: Uint8Array;
}

const KNOWN = new Set<number>(Object.values(FrameType));

export function encodeFrame(
  type: FrameTypeValue,
  stream: number,
  payload: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + payload.length);
  out[0] = type;
  new DataView(out.buffer).setUint32(1, stream, false);
  out.set(payload, HEADER_SIZE);
  return out;
}

/** Returns null for anything that is not a valid frame; callers drop it. */
export function decodeFrame(data: Uint8Array): Frame | null {
  if (data.length < HEADER_SIZE) return null;
  const type = data[0] as number;
  if (!KNOWN.has(type)) return null;
  const stream = new DataView(data.buffer, data.byteOffset).getUint32(1, false);
  if (stream === 0) return null;
  const payload = data.subarray(HEADER_SIZE);
  if (type === FrameType.Window && payload.length !== 4) return null;
  if (payload.length > MAX_PAYLOAD) return null;
  return { type: type as FrameTypeValue, stream, payload };
}

export function windowPayload(credit: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, credit, false);
  return out;
}

export function parseWindow(payload: Uint8Array): number {
  return new DataView(payload.buffer, payload.byteOffset).getUint32(0, false);
}

/** Control messages (text WebSocket messages). */
export interface ControlMessage {
  type: string;
  protocol?: number;
  version?: string;
  name?: string;
  hostname?: string;
  os?: string;
  arch?: string;
  localAddrs?: string[];
  targets?: string[];
  activeStreams?: number;
  observedIp?: string;
  maxStreams?: number;
  code?: string;
  message?: string;
}

export type OpenErrorCode =
  | "not_allowed"
  | "unreachable"
  | "timeout"
  | "too_many_streams"
  | "bad_target"
  | "offline";

export class TunnelError extends Error {
  constructor(
    readonly code: OpenErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TunnelError";
  }
}

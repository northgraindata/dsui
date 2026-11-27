/* What the prototype's actions change, so a result is visible on screen. */
import { useSyncExternalStore } from "react";
import { type Entry, listPrefix, NOW, parentOf } from "./data";

let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version += 1;
  for (const listener of listeners) listener();
};

export const useStore = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );

export function addEntry(bucket: string, entry: Entry) {
  const list = listPrefix(bucket, parentOf(entry.key));
  if (!list.some((item) => item.key === entry.key)) list.push(entry);
  list.sort((a, b) => (a.key < b.key ? -1 : 1));
  changed();
}

export function removeEntries(
  bucket: string,
  prefix: string,
  keys: readonly string[],
) {
  const list = listPrefix(bucket, prefix);
  for (const key of keys) {
    const index = list.findIndex((item) => item.key === key);
    if (index >= 0) list.splice(index, 1);
  }
  changed();
}

export interface Transfer {
  id: number;
  bucket: string;
  key: string;
  size: number;
  progress: number;
}
export let transfers: Transfer[] = [];
let nextId = 1;

export function clearTransfers() {
  transfers = transfers.filter((item) => item.progress < 100);
  changed();
}

/** Moves one transfer forward until its object appears in the listing. */
function run(item: Transfer) {
  const timer = window.setInterval(() => {
    const progress = Math.min(
      100,
      (transfers.find((entry) => entry.id === item.id)?.progress ?? 100) + 12,
    );
    transfers = transfers.map((entry) =>
      entry.id === item.id ? { ...entry, progress } : entry,
    );
    if (progress < 100) return changed();
    window.clearInterval(timer);
    addEntry(item.bucket, {
      key: item.key,
      size: item.size,
      modified: NOW,
      storageClass: "STANDARD",
    });
  }, 220);
}

export function upload(
  bucket: string,
  prefix: string,
  files: readonly { name: string; size: number }[],
) {
  for (const file of files) {
    const item: Transfer = {
      id: nextId++,
      bucket,
      key: `${prefix}${file.name}`,
      size: file.size,
      progress: 0,
    };
    transfers = [...transfers, item];
    run(item);
  }
  changed();
}

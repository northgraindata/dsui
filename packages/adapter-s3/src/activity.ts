import { defineStore } from "@northgraindata/dsui-adapter-sdk";
export interface Activity {
  id: string;
  operation: string;
  key: string;
  bucket: string;
  at: string;
}
export const activityStore = defineStore({
  id: "s3-activity",
  scope: "adapter",
  persistence: { type: "persistent", key: "s3-activity", version: 1 },
  state: { entries: [] as Activity[] },
  actions: () => ({}),
});

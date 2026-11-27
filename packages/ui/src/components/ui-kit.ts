import type { UiKit } from "../kit";
import { ConfirmDialog } from "./confirm-dialog";
import { Menu } from "./menu";
import { Modal } from "./modal";
import { Select } from "./select";
import { notify } from "./toast";
import { Tooltip } from "./tooltip";

/** The components the host hands to extension bundles. See `../kit.ts`. */
export const uiKit: UiKit = {
  Select,
  Tooltip,
  Menu,
  ConfirmDialog,
  Modal,
  notify,
};

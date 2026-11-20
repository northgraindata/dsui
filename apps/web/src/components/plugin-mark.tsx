import { useState } from "react";
import { Icon } from "./icon";

export function PluginMark({ iconUrl }: { iconUrl?: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <span className="plugin-mark" aria-hidden="true">
      {iconUrl && iconUrl !== failedUrl ? (
        <img
          src={iconUrl}
          alt=""
          width={24}
          height={24}
          onError={() => setFailedUrl(iconUrl)}
        />
      ) : (
        <Icon name="plug" size={18} />
      )}
    </span>
  );
}

import React from "react";

export const FLAG_COMPONENTS: Record<string, React.FC> = {
  NG: () => <span>🇳🇬</span>,
  US: () => <span>🇺🇸</span>,
  GB: () => <span>🇬🇧</span>,
};

export default FLAG_COMPONENTS;

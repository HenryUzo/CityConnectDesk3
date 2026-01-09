import React from "react";

type FlagProps = { size?: number };

export const FLAG_COMPONENTS: Record<string, React.FC<FlagProps>> = {
  NG: (props) => React.createElement("span", { style: { fontSize: props?.size } }, "🇳🇬"),
  US: (props) => React.createElement("span", { style: { fontSize: props?.size } }, "🇺🇸"),
  GB: (props) => React.createElement("span", { style: { fontSize: props?.size } }, "🇬🇧"),
};

export default FLAG_COMPONENTS;

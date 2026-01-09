import React, { FC } from "react";

export const TabGroup: FC<{
  tabs?: { id: string; label: string; disabled?: boolean; comingSoon?: boolean }[];
  defaultActiveTab?: string;
  onTabChange?: (tabId: string) => void;
} & React.PropsWithChildren<{}>> = ({ children }) => {
  return <div className="tab-group">{children}</div>;
};

export const TabItem: FC<{ id?: string; label?: string } & React.PropsWithChildren<{}>> = ({ children }) => {
  return <div className="tab-item">{children}</div>;
};

import * as React from "react";

export const ProfilePics: React.FC<{
  size?: number;
  withBorder?: boolean;
  customImage?: string | null;
}> = ({ size = 48, withBorder = false, customImage = null }) => {
  const px = size;
  const src = customImage || `https://ui-avatars.com/api/?name=User&size=${px * 2}&background=039855&color=fff`;

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-block",
        border: withBorder ? "4px solid rgba(3,152,85,0.12)" : undefined,
      }}
    >
      <img src={src} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

export default ProfilePics;

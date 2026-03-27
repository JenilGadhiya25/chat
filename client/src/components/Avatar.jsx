import { useEffect, useState } from "react";
import { resolveMediaUrl } from "../lib/mediaUrl";

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
  xxl: "w-28 h-28 text-3xl",
};

const colors = [
  "bg-[#00a884]", "bg-[#0088cc]", "bg-[#8e44ad]",
  "bg-[#e74c3c]", "bg-[#f39c12]", "bg-[#16a085]",
  "bg-[#2980b9]", "bg-[#d35400]", "bg-[#c0392b]",
];

function getColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const resolveAvatar = (src) => {
  if (!src) return { type: "none" };
  if (src.startsWith("color:")) return { type: "color", value: src.slice(6) };
  return { type: "img", value: resolveMediaUrl(src) };
};

export default function Avatar({ src, name = "", size = "md" }) {
  const [imgBroken, setImgBroken] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const sizeClass = sizes[size] || sizes.md;
  const resolved = resolveAvatar(src);
  useEffect(() => {
    setImgBroken(false);
  }, [src]);

  if (resolved.type === "img" && !imgBroken) {
    return (
      <img
        src={resolved.value}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        onError={() => setImgBroken(true)}
      />
    );
  }

  if (resolved.type === "color") {
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-medium flex-shrink-0`}
        style={{ background: resolved.value }}>
        {initials || "?"}
      </div>
    );
  }

  return (
    <div className={`${sizeClass} ${getColor(name)} rounded-full flex items-center justify-center text-white font-medium flex-shrink-0`}>
      {initials || "?"}
    </div>
  );
}

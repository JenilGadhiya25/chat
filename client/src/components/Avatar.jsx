import { SERVER_URL } from "../lib/axios";

// Reusable avatar with fallback initials
const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

const colors = [
  "bg-red-400", "bg-orange-400", "bg-yellow-400",
  "bg-green-400", "bg-teal-400", "bg-blue-400",
  "bg-indigo-400", "bg-purple-400", "bg-pink-400",
];

function getColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name = "", size = "md" }) {
  const initials = name.slice(0, 2).toUpperCase();
  const sizeClass = sizes[size] || sizes.md;
  const resolvedSrc = src
    ? src.startsWith("http")
      ? src
      : src.startsWith("/presets/")
        ? src
      : `${SERVER_URL}${src}`
    : "";

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClass} ${getColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials || "?"}
    </div>
  );
}

import { useId } from "react";
import { defaultAvatar } from "../core/avatars";
import { avatarSrc } from "../lib/avatar";

/** The app logo's speech bubble on a default picture's background, in a circle. */
export function DefaultAvatarArt({ avatarKey, size }: { avatarKey: string; size: number }) {
  const look = defaultAvatar(avatarKey);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!look) return null;
  const [from, to = from] = look.colors;
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden="true" style={{ display: "block", borderRadius: "50%" }}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
      </defs>
      <circle cx="512" cy="512" r="512" fill={`url(#${id}bg)`} />
      {/* The logo, a little smaller so the bubble sits inside the circle. */}
      <g transform="translate(512 512) scale(0.74) translate(-512 -536)">
        <path fill="#FFFFFF" d="M292 200 H732 A140 140 0 0 1 872 340 V610 A140 140 0 0 1 732 750 H430 L262 872 A14 14 0 0 1 240 858 L262 742 A140 140 0 0 1 152 610 V340 A140 140 0 0 1 292 200 Z" />
        <circle cx="392" cy="548" r="62" fill="none" stroke={look.ink} strokeWidth="46" />
        <circle cx="632" cy="548" r="62" fill="none" stroke={look.ink} strokeWidth="46" />
      </g>
    </svg>
  );
}

/** A saved picture: a photo, or a default picture (by its key). Null when there is none. */
export function AvatarImage({ avatar, size, className }: { avatar: string | null; size: number; className?: string }) {
  if (!avatar) return null;
  if (defaultAvatar(avatar)) {
    return <span className={className} style={{ width: size, height: size, display: "inline-block" }}><DefaultAvatarArt avatarKey={avatar} size={size} /></span>;
  }
  return <img className={className} src={avatarSrc(avatar)} alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

import { AVATAR_PRESETS, avatarURL, toAvatarPreset } from "../core/avatars";

/** A saved picture (a preset key) in a circle. Null when there is none; an unknown value shows the default preset. */
export function AvatarImage({ avatar, size, className }: { avatar: string | null; size: number; className?: string }) {
  if (!avatar) return null;
  return <img className={`avatar-image ${className ?? ""}`} src={avatarURL(toAvatarPreset(avatar))} alt="" width={size} height={size}
    style={{ width: size, height: size }} draggable={false} />;
}

/** The eight pictures to choose from, the chosen one ringed. */
export function AvatarPicker({ value, onChange }: { value: string | null; onChange: (preset: string) => void }) {
  return (
    <div className="avatar-grid" role="radiogroup" aria-label="Profile picture">
      {AVATAR_PRESETS.map((preset) => (
        <button key={preset} type="button" role="radio" aria-checked={value === preset} aria-label={preset} title={preset}
          className={`avatar-choice ${value === preset ? "on" : ""}`} onClick={() => onChange(preset)}>
          <img src={avatarURL(preset)} alt="" width={56} height={56} draggable={false} />
        </button>
      ))}
    </div>
  );
}

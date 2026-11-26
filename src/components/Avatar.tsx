import { useRef, useState } from "react";
import { AVATAR_PRESETS, avatarURL, isPhotoAvatar, shownAvatar } from "../core/avatars";
import { avatarSrc, squareJPEGBase64 } from "../lib/avatar";
import { upgradeToPro } from "../lib/upgrade";
import { Icon } from "./Icon";

/** A saved picture (a preset key, or a Pro account's photo) in a circle. Null when there is none; an unknown value
 *  shows the default preset. */
export function AvatarImage({ avatar, size, className }: { avatar: string | null; size: number; className?: string }) {
  const shown = shownAvatar(avatar);
  if (!shown) return null;
  return <img className={`avatar-image ${className ?? ""}`} src={shown === "photo" ? avatarSrc(avatar!) : avatarURL(shown)} alt=""
    width={size} height={size} style={{ width: size, height: size }} draggable={false} />;
}

/** The seven presets to choose from, the chosen one ringed, and an upload tile at the end: Pro accounts pick their own
 *  photo there (the tile then shows it); free accounts go to Upgrade to Pro. */
export function AvatarPicker({ value, onChange, canUpload }: { value: string | null; onChange: (avatar: string) => void; canUpload: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Your own photo is for Pro accounts: a free account's upload tile never shows or keeps one.
  const photo = canUpload && isPhotoAvatar(value) ? value : null;
  return (
    <div className="stack avatar-picker">
      <div className="avatar-grid" role="radiogroup" aria-label="Profile picture">
        {AVATAR_PRESETS.map((preset) => (
          <button key={preset} type="button" role="radio" aria-checked={value === preset} aria-label={preset} title={preset}
            className={`avatar-choice ${value === preset ? "on" : ""}`} onClick={() => onChange(preset)}>
            <img src={avatarURL(preset)} alt="" width={56} height={56} draggable={false} />
          </button>
        ))}
        <button type="button" role="radio" aria-checked={photo !== null}
          aria-label={canUpload ? (photo ? "Your photo. Choose another" : "Upload your own photo") : "Upload your own photo with Pro"}
          title={canUpload ? "Upload Photo" : "Upload your own photo with Pro"}
          className={`avatar-choice avatar-upload ${photo ? "on" : ""}`}
          onClick={(e) => (canUpload ? file.current?.click() : upgradeToPro(e.currentTarget))}>
          {photo ? <img src={avatarSrc(photo)} alt="" width={56} height={56} draggable={false} />
            : <span className="avatar-upload-art"><Icon name="camera" size={24} /></span>}
          {!canUpload && <span className="avatar-upload-pro">Pro</span>}
        </button>
      </div>
      {canUpload && (
        <input ref={file} type="file" accept="image/*" hidden aria-label="Upload photo" onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (!picked) return;
          setError(null);
          try { onChange(await squareJPEGBase64(picked)); } catch { setError("Couldn't read that picture."); }
        }} />
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}

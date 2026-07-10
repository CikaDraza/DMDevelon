"use client";

import { useRef, useState } from "react";
import { User, Camera, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Circular profile avatar with a camera button (bottom-right) that uploads a new
 * picture. Presentational: the parent owns the auth hook and passes `uploadAvatar`
 * (see useAuth) which handles Cloudinary + persisting the URL on the user.
 *
 * The image is fitted with object-cover so it always fills the frame regardless
 * of its aspect ratio.
 */
export function AvatarUploader({ user, uploadAvatar, size = 80, className = "" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(
        err.response?.data?.error || err.message || "Failed to upload picture",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`relative mx-auto ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-[#FFB633]/20 flex items-center justify-center">
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name || "Profile picture"}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-1/2 h-1/2 text-[#FFB633]" />
        )}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-1/3 h-1/3 text-white animate-spin" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile picture"
        title="Change profile picture"
        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#FFB633] text-black flex items-center justify-center shadow-md border-2 border-[#1a1a1b] hover:bg-[#e5a32e] transition-colors disabled:opacity-60"
      >
        <Camera className="w-4 h-4" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

export default AvatarUploader;

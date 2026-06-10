import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

type ProfileAvatarProps = {
  avatarUrl?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
};

export function ProfileAvatar({ avatarUrl, alt, className, imageClassName, iconClassName }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-full", className)}>
      {avatarUrl && !imageFailed ? (
        <img
          alt={alt}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
          src={avatarUrl}
        />
      ) : (
        <span className={cn("material-symbols-outlined text-on-surface-variant", iconClassName)}>person</span>
      )}
    </div>
  );
}

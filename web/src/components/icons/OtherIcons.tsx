import { FcCollaboration, FcBookmark, FcFlashOn, FcClock, FcList, FcLock } from 'react-icons/fc';

interface IconProps {
  className?: string;
}

export function CollaborationIcon({ className = '' }: IconProps) {
  return <FcCollaboration className={className} />;
}

export function BookmarkIcon({ className = '' }: IconProps) {
  return <FcBookmark className={className} />;
}

export function FlashOnIcon({ className = '' }: IconProps) {
  return <FcFlashOn className={className} />;
}

export function ClockIcon({ className = '' }: IconProps) {
  return <FcClock className={className} />;
}

export function ListIcon({ className = '' }: IconProps) {
  return <FcList className={className} />;
}

export function LockIcon({ className = '' }: IconProps) {
  return <FcLock className={className} />;
}


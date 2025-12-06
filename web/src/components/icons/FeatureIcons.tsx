import { FcUpload, FcIdea, FcAlarmClock, FcBarChart } from 'react-icons/fc';

interface IconProps {
  className?: string;
}

export function UploadIcon({ className = '' }: IconProps) {
  return <FcUpload className={className} />;
}

export function IdeaIcon({ className = '' }: IconProps) {
  return <FcIdea className={className} />;
}

export function AlarmClockIcon({ className = '' }: IconProps) {
  return <FcAlarmClock className={className} />;
}

export function BarChartIcon({ className = '' }: IconProps) {
  return <FcBarChart className={className} />;
}


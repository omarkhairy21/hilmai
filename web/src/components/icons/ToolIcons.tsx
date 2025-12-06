import { 
  FcBarChart, 
  FcMoneyTransfer, 
  FcApproval, 
  FcLineChart, 
  FcDocument,
  FcLike,
  FcCalendar,
  FcClock,
  FcStatistics,
  FcFlashOn,
  FcIdea,
  FcCellPhone
} from 'react-icons/fc';

interface IconProps {
  className?: string;
}

export function BudgetIcon({ className = '' }: IconProps) {
  return <FcBarChart className={className} />;
}

export function EmergencyFundIcon({ className = '' }: IconProps) {
  return <FcMoneyTransfer className={className} />;
}

export function DebtPayoffIcon({ className = '' }: IconProps) {
  return <FcApproval className={className} />;
}

export function SavingsGoalIcon({ className = '' }: IconProps) {
  return <FcLineChart className={className} />;
}

export function DebtToIncomeIcon({ className = '' }: IconProps) {
  return <FcDocument className={className} />;
}

export function FinancialHealthIcon({ className = '' }: IconProps) {
  return <FcLike className={className} />;
}

export function BudgetPlannerIcon({ className = '' }: IconProps) {
  return <FcCalendar className={className} />;
}

export function RetirementIcon({ className = '' }: IconProps) {
  return <FcClock className={className} />;
}

export function InvestmentIcon({ className = '' }: IconProps) {
  return <FcStatistics className={className} />;
}

export function InstantTrackingIcon({ className = '' }: IconProps) {
  return <FcFlashOn className={className} />;
}

export function AIInsightsIcon({ className = '' }: IconProps) {
  return <FcIdea className={className} />;
}

export function MultipleWaysIcon({ className = '' }: IconProps) {
  return <FcCellPhone className={className} />;
}


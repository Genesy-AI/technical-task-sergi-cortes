import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconLoader2,
  IconRefresh,
} from '@tabler/icons-react'
import { FC } from 'react'
import { EmailVerificationStatus } from '../api/types/leads/getMany'

interface EmailVerificationCellProps {
  email: string | null
  status: EmailVerificationStatus
  onRetry: () => void
  isRetrying: boolean
}

const STATUS_DISPLAY: Record<
  Exclude<EmailVerificationStatus, 'PENDING'>,
  { label: string; Icon: TablerIcon; className: string }
> = {
  UNVERIFIED: { label: 'Not verified', Icon: IconCircleDashed, className: 'text-gray-400' },
  VERIFIED: { label: 'Verified', Icon: IconCircleCheck, className: 'text-emerald-600' },
  INVALID: { label: 'Invalid', Icon: IconCircleX, className: 'text-red-600' },
  FAILED: { label: "Couldn't verify", Icon: IconAlertTriangle, className: 'text-amber-600' },
}

/** Shows a lead's email with its verification state, and lets the user retry a check that could not complete. */
export const EmailVerificationCell: FC<EmailVerificationCellProps> = ({
  email,
  status,
  onRetry,
  isRetrying,
}) => (
  <div className="text-sm text-gray-900">
    <div>{email || '-'}</div>
    <div className="mt-0.5 flex items-center gap-2 text-xs">
      {status === 'PENDING' ? (
        <span role="status" aria-label="Verifying" className="inline-flex items-center gap-1 text-blue-600">
          <IconLoader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Verifying
        </span>
      ) : (
        <StatusBadge status={status} />
      )}
      {status === 'FAILED' && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          aria-label="Retry verification"
          className="inline-flex items-center gap-1 rounded px-1 font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          <IconRefresh className="h-3.5 w-3.5" aria-hidden />
          Retry
        </button>
      )}
    </div>
  </div>
)

const StatusBadge: FC<{ status: Exclude<EmailVerificationStatus, 'PENDING'> }> = ({ status }) => {
  const { label, Icon, className } = STATUS_DISPLAY[status]
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}

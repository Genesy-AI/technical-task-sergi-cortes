import { IconAlertTriangle, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { FC } from 'react'
import { LeadsGetManyOutput, PhoneLookupAttempt } from '../api/types/leads/getMany'
import { PROVIDER_LABELS, telHref } from './phoneDisplay'

type Lead = LeadsGetManyOutput[number]

const describeAttempt = (attempt: PhoneLookupAttempt) => {
  const label = PROVIDER_LABELS[attempt.provider]
  switch (attempt.result) {
    case 'SKIPPED':
      return `${label}: skipped, ${attempt.reason}`
    case 'NOT_FOUND':
      return `${label}: no phone`
    case 'ERRORED':
      return `${label}: ${attempt.error}`
    case 'FOUND':
      return `${label}: found ${attempt.phone}`
  }
}

const attemptsSummary = (lead: Lead) => (lead.phoneEnrichmentAttempts ?? []).map(describeAttempt).join('\n')

interface PhoneCellProps {
  lead: Lead
  /** Starts a lookup for this lead; `force` replaces an existing phone. */
  onEnrich: (force: boolean) => void
  isStarting: boolean
}

const actionButton =
  'inline-flex items-center gap-1 rounded px-1 font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50'

/** Shows a lead's phone with where it came from and the state of its phone lookup. */
export const PhoneCell: FC<PhoneCellProps> = ({ lead, onEnrich, isStarting }) => {
  const { phone, phoneSource, phoneEnrichmentStatus: status, phoneEnrichmentProgress: progress } = lead

  const reEnrich = () => {
    if (window.confirm(`Replace ${phone} with a phone from the providers, if one is found?`)) onEnrich(true)
  }

  return (
    <div className="min-w-44 text-sm text-gray-900">
      {phone ? (
        <a href={telHref(phone)} className="text-gray-900 hover:text-blue-600 hover:underline">
          {phone}
        </a>
      ) : (
        <span className="text-gray-400">-</span>
      )}
      <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xs">
        {status === 'PENDING' ? (
          <PendingLabel
            label={
              progress
                ? `Trying ${PROVIDER_LABELS[progress.provider]} (${progress.position}/${progress.total})`
                : 'Looking up phone'
            }
          />
        ) : status === 'FAILED' ? (
          <>
            <span className="inline-flex items-center gap-1 text-amber-600" title={attemptsSummary(lead)}>
              <IconAlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Lookup failed
            </span>
            <button
              type="button"
              onClick={() => onEnrich(Boolean(phone))}
              disabled={isStarting}
              aria-label="Retry phone lookup"
              className={actionButton}
            >
              <IconRefresh className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </>
        ) : status === 'NOT_FOUND' && !phone ? (
          <span className="text-gray-500" title={attemptsSummary(lead)}>
            No data found
          </span>
        ) : phoneSource && phoneSource !== 'IMPORT' ? (
          <span
            className="text-gray-500"
            title={attemptsSummary(lead)}
          >{`via ${PROVIDER_LABELS[phoneSource]}`}</span>
        ) : null}
        {phone && status !== 'PENDING' && status !== 'FAILED' && (
          <button type="button" onClick={reEnrich} disabled={isStarting} className={actionButton}>
            <IconRefresh className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Re-enrich phone</span>
          </button>
        )}
      </div>
    </div>
  )
}

const PendingLabel: FC<{ label: string }> = ({ label }) => (
  <span role="status" aria-label={label} className="inline-flex items-center gap-1 text-blue-600">
    <IconLoader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    {label}
  </span>
)

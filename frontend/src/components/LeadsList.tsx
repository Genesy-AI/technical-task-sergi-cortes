import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FC, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { MessageTemplateModal } from './MessageTemplateModal'
import { CsvImportModal } from './CsvImportModal'
import { EmailVerificationCell } from './EmailVerificationCell'
import { pollIntervalFor } from './leadsPolling'
import { ColumnMenu } from './ColumnMenu'
import { useColumnVisibility } from './columnVisibility'
import { LeadsTable } from './LeadsTable'

const leadsLabel = (count: number) => (count === 1 ? `${count} lead` : `${count} leads`)

export const LeadsList: FC = () => {
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [isEnrichDropdownOpen, setIsEnrichDropdownOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const fields = useQuery({
    queryKey: ['leads', 'fields'],
    queryFn: async () => api.leads.getFields(),
    staleTime: Infinity,
  })
  const columns = useColumnVisibility(fields.data?.fields)

  const leads = useQuery({
    queryKey: ['leads', 'getMany'],
    queryFn: async () => api.leads.getMany(),
    retry: false,
    // Verification runs in the background, so keep refreshing until no lead is pending.
    refetchInterval: (query) => pollIntervalFor(query.state.data),
  })

  const deleteLeadsMutation = useMutation({
    mutationFn: async (ids: number[]) => api.leads.deleteMany({ ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'getMany'] })
      setSelectedLeads([])

      const message =
        data.deletedCount === 1
          ? `Successfully deleted ${data.deletedCount} lead`
          : `Successfully deleted ${data.deletedCount} leads`
      toast.success(message)
    },
    onError: () => {
      toast.error('Failed to delete leads. Please try again.')
    },
  })

  const verifyEmailsMutation = useMutation({
    mutationFn: async (ids: number[]) => api.leads.verifyEmails({ leadIds: ids }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'getMany'] })
      if (data.started.length > 0)
        toast.success(`Verification started for ${leadsLabel(data.started.length)}`)
      if (data.failed.length > 0)
        toast.error(`Could not start verification for ${leadsLabel(data.failed.length)}`)
    },
    onError: () => {
      toast.error('Failed to start email verification. Please try again.')
    },
  })

  const startVerification = (ids: number[]) => {
    setIsEnrichDropdownOpen(false)
    verifyEmailsMutation.mutate(ids)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && leads.data) {
      setSelectedLeads(leads.data.map((lead) => lead.id))
    } else {
      setSelectedLeads([])
    }
  }

  const handleSelectLead = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedLeads((prev) => [...prev, leadId])
    } else {
      setSelectedLeads((prev) => prev.filter((id) => id !== leadId))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedLeads.length > 0) {
      deleteLeadsMutation.mutate(selectedLeads)
    }
  }

  if (leads.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-12rem)]">
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
          <div className="flex items-center gap-3">
            {selectedLeads.length > 0 && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-medium text-sm">
                {selectedLeads.length} selected
              </span>
            )}

            <ColumnMenu
              columns={columns.allColumns}
              isVisible={columns.isVisible}
              onToggle={columns.toggle}
            />

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg
                className="-ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Import CSV
            </button>

            <div className="relative">
              <button
                onClick={() => selectedLeads.length > 0 && setIsEnrichDropdownOpen(!isEnrichDropdownOpen)}
                disabled={selectedLeads.length === 0}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="-ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Enrich
                <svg
                  className="ml-2 -mr-1 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isEnrichDropdownOpen && selectedLeads.length > 0 && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsMessageModalOpen(true)
                        setIsEnrichDropdownOpen(false)
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg
                          className="mr-3 h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        Generate Messages
                      </div>
                    </button>
                    <button
                      onClick={() => startVerification(selectedLeads)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg
                          className="mr-3 h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 12H8m8 0a8 8 0 11-16 0 8 8 0 0116 0zm-8 0V4"
                          />
                        </svg>
                        Verify Email
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        toast.error('Gender guessing feature is not yet implemented')
                        setIsEnrichDropdownOpen(false)
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg
                          className="mr-3 h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        Guess Gender
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedLeads.length === 0 || deleteLeadsMutation.isPending}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleteLeadsMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {!leads.isError && (
            <LeadsTable
              leads={leads.data ?? []}
              columns={columns.visibleColumns}
              selectedLeads={selectedLeads}
              onSelectAll={handleSelectAll}
              onSelectLead={handleSelectLead}
              renderEmail={(lead) => (
                <EmailVerificationCell
                  email={lead.email}
                  status={lead.emailVerificationStatus}
                  onRetry={() => startVerification([lead.id])}
                  isRetrying={verifyEmailsMutation.isPending}
                />
              )}
            />
          )}

          {leads.isError && (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mx-6">
                <div className="text-red-800">
                  <h3 className="text-lg font-medium mb-2">Error loading leads</h3>
                  <div className="text-sm text-red-700">
                    {leads.error?.message || 'An unexpected error occurred'}
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          )}

          {!leads.isError && leads.data?.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">
                <div className="text-lg font-medium">No leads found</div>
                <div className="text-sm mt-1">Get started by adding your first lead.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MessageTemplateModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        selectedLeads={(leads.data ?? []).filter((lead) => selectedLeads.includes(lead.id))}
        fields={fields.data?.fields ?? []}
      />

      <CsvImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  )
}

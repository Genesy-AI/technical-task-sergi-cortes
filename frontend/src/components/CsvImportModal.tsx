import { FC, useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../api'
import { CsvRow } from '../api/types/leads/importPreview'
import { readCsvRows } from '../utils/csvParser'
import { ImportPreviewTable } from './ImportPreviewTable'

const leadsLabel = (count: number) => (count === 1 ? `${count} lead` : `${count} leads`)

interface CsvImportModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CsvImportModal: FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<{ name: string; rows: CsvRow[]; loadedAt: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // The backend maps, groups, and validates rows, so the preview shows exactly what the import will store.
  const preview = useQuery({
    queryKey: ['leads', 'importPreview', file?.name, file?.loadedAt],
    queryFn: () => api.leads.importPreview({ rows: file!.rows }),
    enabled: file !== null,
    staleTime: Infinity,
    retry: false,
  })
  const plan = preview.data
  const newLeads = plan?.leads.filter((lead) => lead.status === 'new').length ?? 0
  const existingLeads = plan?.leads.filter((lead) => lead.status === 'duplicate').length ?? 0

  const clearFile = () => setFile(null)

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    setIsProcessing(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        setFile({ name: file.name, rows: readCsvRows(content), loadedAt: Date.now() })
        setIsProcessing(false)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV file'
        toast.error(errorMessage)
        setIsProcessing(false)
      }
    }
    reader.onerror = () => {
      toast.error('Error reading file')
      setIsProcessing(false)
    }
    reader.readAsText(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const importMutation = useMutation({
    mutationFn: async (rows: CsvRow[]) => api.leads.bulkImport({ rows }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'getMany'] })

      let message = `Successfully imported ${leadsLabel(data.importedCount)}`
      if (data.duplicatesSkipped > 0) message += ` (${data.duplicatesSkipped} already existed)`
      if (data.invalidRows > 0) message += ` (${data.invalidRows} invalid rows excluded)`
      toast.success(message)
      onClose()
      clearFile()
    },
    onError: () => {
      toast.error('Error importing leads. Please try again.')
    },
  })

  const handleImport = () => {
    if (file && newLeads > 0) importMutation.mutate(file.rows)
  }

  const handleClose = useCallback(() => {
    if (!importMutation.isPending) {
      clearFile()
      onClose()
    }
  }, [importMutation.isPending, onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Import Leads from CSV</h3>
            <button
              onClick={handleClose}
              disabled={importMutation.isPending}
              className="text-gray-400 hover:text-gray-500 focus:outline-none disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {file === null ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Processing CSV file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <svg
                    className="w-12 h-12 text-gray-400 mb-4"
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
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Drop your CSV file here, or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-500"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-sm text-gray-500">
                    CSV must include: firstName, lastName, email (required). Optional: jobTitle, companyName,
                    countryCode, phoneNumber, linkedinUrl, yearsInRole, isCurrentRole
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Rows with the same email become one person with several roles. The last row is the current
                    role unless isCurrentRole marks another.
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Country accepts ISO codes such as ES, ESP, or 724, or an English name. Unrecognized values
                    are left blank.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {preview.isPending && (
                <div className="flex items-center gap-3 py-8 justify-center text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  Checking {file.name}...
                </div>
              )}
              {preview.isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Could not check this file. Please try again.
                </div>
              )}
              {plan && (
                <>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Import Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <SummaryTile value={plan.totalRows} label="Total Rows" className="text-gray-900" />
                      <SummaryTile value={newLeads} label="Leads to Import" className="text-green-600" />
                      <SummaryTile
                        value={plan.invalidRows.length}
                        label="Invalid Rows"
                        className="text-red-600"
                      />
                      <SummaryTile value={existingLeads} label="Already Exist" className="text-amber-600" />
                    </div>
                  </div>
                  <ImportPreviewTable leads={plan.leads} invalidRows={plan.invalidRows} />
                </>
              )}
            </div>
          )}
        </div>

        {file !== null && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
            <div className="flex space-x-3">
              <button
                onClick={clearFile}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Clear Data
              </button>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!plan || newLeads === 0 || importMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importMutation.isPending
                  ? 'Importing...'
                  : `Import ${newLeads} ${newLeads === 1 ? 'Lead' : 'Leads'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

const SummaryTile: FC<{ value: number; label: string; className: string }> = ({
  value,
  label,
  className,
}) => (
  <div className="bg-white rounded p-3 text-center">
    <div className={`text-lg font-semibold ${className}`}>{value}</div>
    <div className="text-xs text-gray-500">{label}</div>
  </div>
)

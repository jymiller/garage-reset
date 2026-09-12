import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalysisRecord } from './contract.mjs'
import { photoFilenameFromUrl, requestPhotoAnalysis } from './photoAnalysisClient'

const POLL_MS = 5000
const POLL_WINDOW_MS = 120000
const REQUEST_TIMEOUT_MS = 20000

type Snapshot = { filename: string; record: AnalysisRecord | null; loaded: boolean }

export function usePhotoAnalysis(photo: string, active: boolean) {
  const filename = photoFilenameFromUrl(photo)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [issue, setIssue] = useState('')
  const [retryIssue, setRetryIssue] = useState('')
  const [timedOut, setTimedOut] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden')
  const retryController = useRef<AbortController | null>(null)
  const current = snapshot?.filename === filename ? snapshot : null

  useEffect(() => {
    const visibilityChanged = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => document.removeEventListener('visibilitychange', visibilityChanged)
  }, [])
  useEffect(() => () => { retryController.current?.abort() }, [filename])

  useEffect(() => {
    if (!filename || !active || !pageVisible || retrying) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let requestController: AbortController | null = null
    const startedAt = Date.now()
    setIssue(''); setTimedOut(false)

    async function read() {
      requestController = new AbortController()
      const timeout = setTimeout(() => requestController?.abort(), REQUEST_TIMEOUT_MS)
      try {
        const record = await requestPhotoAnalysis(filename!, false, requestController.signal)
        if (cancelled) return
        setSnapshot({ filename: filename!, record, loaded: true })
        setIssue('')
        if (record?.status === 'complete' || record?.status === 'processing' || record?.status === 'queued') setRetryIssue('')
        if (record?.status === 'queued' || record?.status === 'processing') {
          if (Date.now() - startedAt >= POLL_WINDOW_MS) setTimedOut(true)
          else timer = setTimeout(() => { void read() }, POLL_MS)
        }
      } catch (error) {
        if (!cancelled) setIssue(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Analysis check timed out.')
      } finally { clearTimeout(timeout) }
    }
    void read()
    return () => { cancelled = true; clearTimeout(timer); requestController?.abort() }
  }, [filename, active, pageVisible, refresh, retrying])

  const checkAgain = useCallback(() => { setRetryIssue(''); setRefresh(value => value + 1) }, [])
  const tryAnalysis = useCallback(async () => {
    if (!filename || retryController.current) return
    const controller = new AbortController()
    retryController.current = controller
    setRetrying(true); setIssue(''); setRetryIssue(''); setTimedOut(false)
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const record = await requestPhotoAnalysis(filename, true, controller.signal)
      if (!controller.signal.aborted) setSnapshot({ filename, record, loaded: true })
    } catch (error) {
      if (!controller.signal.aborted) setRetryIssue(error instanceof Error ? error.message : 'Analysis could not start.')
      else if (retryController.current === controller) setRetryIssue('Analysis request timed out. Check again.')
    } finally {
      clearTimeout(timeout)
      if (retryController.current === controller) {
        retryController.current = null
        setRetrying(false)
      }
    }
  }, [filename])

  return { filename, record: current?.record ?? null, loaded: current?.loaded ?? false, issue: retryIssue || issue, timedOut, retrying, checkAgain, tryAnalysis }
}

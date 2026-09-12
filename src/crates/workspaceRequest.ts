/** Bound both the response and JSON body read, without touching local drafts. */
export async function fetchWorkspaceJson(
  init: RequestInit = {},
  { signal, timeoutMs = 20000, request = fetch }: { signal?: AbortSignal; timeoutMs?: number; request?: typeof fetch } = {},
): Promise<{ response: Response; remote: Record<string, unknown> }> {
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('Workspace request timed out.', 'TimeoutError')), timeoutMs)
  let rejectAbort: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason ?? new DOMException('Request aborted.', 'AbortError'))
    controller.signal.addEventListener('abort', rejectAbort, { once: true })
    if (controller.signal.aborted) rejectAbort()
  })
  try {
    // Racing also bounds a stalled body read after headers arrive. The abort
    // signal closes the underlying fetch, while late results cannot be returned.
    const result = (async () => {
      controller.signal.throwIfAborted()
      const response = await request('/api/workspace', { ...init, signal: controller.signal })
      const body: unknown = await response.json()
      controller.signal.throwIfAborted()
      const remote = body && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown> : {}
      return { response, remote }
    })()
    return await Promise.race([result, aborted])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', rejectAbort)
  }
}

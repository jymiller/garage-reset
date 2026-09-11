import type { Workspace } from './model'

export type Snapshot = { revision: number; data: Workspace; dirty: boolean }
export type RemoteSnapshot = { revision: number; data: Workspace }

export function validRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
}

/** Call with the latest snapshot when a response arrives, not when it starts. */
export function applyRemote(current: Snapshot, remote: RemoteSnapshot, blocked: boolean): Snapshot {
  if (blocked || current.dirty || !validRevision(remote.revision) || remote.revision < current.revision) return current
  return { revision: remote.revision, data: remote.data, dirty: false }
}

/** Acknowledging an earlier write must preserve edits made while it was pending. */
export function acknowledgeSave(current: Snapshot, sent: Snapshot, revision: number): Snapshot | null {
  if (!validRevision(revision) || revision <= sent.revision || revision < current.revision) return null
  return { ...current, revision, dirty: current.data !== sent.data }
}

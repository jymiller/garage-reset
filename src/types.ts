export type PersonId = 'john' | 'griffin' | 'lj'

export type ZoneId =
  | 'griffin-workshop'
  | 'griffin-fitness'
  | 'lj-clothing'
  | 'john-table'
  | 'shared-storage'
  | 'exit-zone'

export type TaskStatus = 'not-started' | 'in-progress' | 'done' | 'blocked'

export type Decision = 'undecided' | 'keep' | 'move' | 'donate' | 'trash'

export interface Person {
  id: PersonId
  name: string
}

export interface Zone {
  id: ZoneId
  name: string
}

export interface Task {
  id: string
  title: string
  person: PersonId
  zone: ZoneId
  status: TaskStatus
  order: number
  weight?: number // 1-3 effort tier → 50/100/150 XP (defaults to 1)
}

export interface Item {
  id: string
  name: string
  owner: PersonId | null
  zone: ZoneId | null
  decision: Decision
  createdAt: number
}

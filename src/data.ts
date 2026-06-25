import type { Person, Zone, Task, PersonId, ZoneId } from './types'

export const people: Person[] = [
  { id: 'john', name: 'John' },
  { id: 'griffin', name: 'Griffin' },
  { id: 'lj', name: 'LJ' },
]

export const zones: Zone[] = [
  { id: 'griffin-workshop', name: 'Griffin Workshop' },
  { id: 'griffin-fitness', name: 'Griffin Fitness / Personal' },
  { id: 'lj-clothing', name: 'LJ Clothing & Shoes' },
  { id: 'john-table', name: 'John White Table' },
  { id: 'shared-storage', name: 'Shared Storage' },
  { id: 'exit-zone', name: 'Donate / Trash / Exit Zone' },
]

export const personName = (id: PersonId): string =>
  people.find((p) => p.id === id)?.name ?? id

export const zoneName = (id: ZoneId | null): string =>
  id ? zones.find((z) => z.id === id)?.name ?? id : 'Unassigned'

const seed: Array<{ title: string; person: PersonId; zone: ZoneId }> = [
  { title: 'Clear the white table', person: 'john', zone: 'john-table' },
  { title: 'Sort the banker boxes', person: 'john', zone: 'john-table' },
  { title: 'Make scan / archive / trash piles', person: 'john', zone: 'john-table' },
  { title: 'Gather the mechanics tools', person: 'griffin', zone: 'griffin-workshop' },
  { title: 'Collect the games', person: 'griffin', zone: 'griffin-fitness' },
  { title: 'Define the weight corner', person: 'griffin', zone: 'griffin-fitness' },
  { title: 'Decide on the dresser & lamp', person: 'griffin', zone: 'griffin-fitness' },
  { title: 'Sort the shoes', person: 'lj', zone: 'lj-clothing' },
  { title: 'Sort the gray wardrobe', person: 'lj', zone: 'lj-clothing' },
  { title: 'Make keep / donate / seasonal piles', person: 'lj', zone: 'lj-clothing' },
]

export function seedTasks(): Task[] {
  return seed.map((s, i) => ({
    id: `seed-${i}`,
    title: s.title,
    person: s.person,
    zone: s.zone,
    status: 'not-started',
    order: i,
  }))
}

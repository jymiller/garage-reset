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

const seed: Array<{ title: string; person: PersonId; zone: ZoneId; weight: number; steps?: string[] }> = [
  {
    title: 'Clear the white table',
    person: 'john',
    zone: 'john-table',
    weight: 3,
    steps: ['Wipe it down', 'Sort the papers', 'Box the electronics', 'Haul the trash'],
  },
  {
    title: 'Sort the banker boxes',
    person: 'john',
    zone: 'john-table',
    weight: 2,
    steps: ['Open & triage', 'Shred the junk', 'Label the keepers'],
  },
  { title: 'Make scan / archive / trash piles', person: 'john', zone: 'john-table', weight: 1 },
  { title: 'Gather the mechanics tools', person: 'griffin', zone: 'griffin-workshop', weight: 2 },
  { title: 'Collect the games', person: 'griffin', zone: 'griffin-fitness', weight: 1 },
  { title: 'Define the weight corner', person: 'griffin', zone: 'griffin-fitness', weight: 2 },
  { title: 'Decide on the dresser & lamp', person: 'griffin', zone: 'griffin-fitness', weight: 1 },
  {
    title: 'Sort the shoes',
    person: 'lj',
    zone: 'lj-clothing',
    weight: 2,
    steps: ['Pair them up', 'Toss the worn-out', 'Box the off-season'],
  },
  {
    title: 'Sort the gray wardrobe',
    person: 'lj',
    zone: 'lj-clothing',
    weight: 3,
    steps: ['Empty the shelves', 'Sort by season', 'Fold & restock', 'Bag the donations'],
  },
  { title: 'Make keep / donate / seasonal piles', person: 'lj', zone: 'lj-clothing', weight: 2 },
]

export function seedTasks(): Task[] {
  return seed.map((s, i) => ({
    id: `seed-${i}`,
    title: s.title,
    person: s.person,
    zone: s.zone,
    status: 'not-started',
    order: i,
    weight: s.weight,
    steps: s.steps,
  }))
}

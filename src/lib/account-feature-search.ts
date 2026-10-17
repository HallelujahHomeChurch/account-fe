export type AccountFeatureSearchItem = {
  id: string
  label: string
  category: string
  keywords: string[]
  to: string
}

export function findAccountFeatures(items: readonly AccountFeatureSearchItem[], query: string): AccountFeatureSearchItem[] {
  const term = query.trim().toLocaleLowerCase()
  return term ? items.filter(item => [item.label, item.category, ...item.keywords].some(value => value.toLocaleLowerCase().includes(term))) : []
}

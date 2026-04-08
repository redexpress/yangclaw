import type { YangclawConfig } from '../config/types.models'

export type ModelCatalogEntry = {
  /** providerKey/modelId */
  id: string
  name: string
  provider: string
  reasoning: boolean
  input: Array<'text' | 'image'>
}

export function buildCatalog(config: YangclawConfig): ModelCatalogEntry[] {
  const out: ModelCatalogEntry[] = []
  for (const [providerkey, p] of Object.entries(config.models.providers)) {
    for (const m of p.models) {
      out.push({
        id: `${providerkey}/${m.id}`,
        name: m.name,
        provider: providerkey,
        reasoning: m.reasoning,
        input: m.input,
      })
    }
  }
  out.sort((a, b) => {
    const pc = a.provider.localeCompare(b.provider)
    if (pc !== 0) return pc
    return a.name.localeCompare(b.name)
  })
  return out
}

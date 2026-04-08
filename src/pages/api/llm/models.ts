import type { NextApiRequest, NextApiResponse } from 'next'
import { loadYangclawFromDir } from '@/lib/config/load-yangclaw'
import { buildCatalog } from '@/lib/llm/catalog'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const loaded = loadYangclawFromDir()
  if (!loaded.ok) {
    res.status(200).json({
      mode: 'env' as const,
      models: [],
      defaultModel: null as string | null,
    })
    return
  }

  const models = buildCatalog(loaded.config)
  const defaultModel =
    loaded.config.agents?.defaults?.model?.primary ?? models[0]?.id ?? null

  res.status(200).json({
    mode: 'yaml' as const,
    models,
    defaultModel,
  })
}

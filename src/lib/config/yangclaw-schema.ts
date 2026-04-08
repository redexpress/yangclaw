import { z } from 'zod'

const costSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
})

const modelDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  reasoning: z.boolean(),
  input: z.array(z.enum(['text', 'image'])),
  cost: costSchema,
  contextWindow: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  compat: z.any().optional(),
})

const providerSchema = z.object({
  baseUrl: z.string().min(1),
  api: z.enum(['openai-completions', 'anthropic-messages']),
  auth: z.enum(['api-key', 'aws-sdk', 'oauth', 'token']).optional(),
  apiKey: z.string(),
  headers: z.record(z.string()).optional(),
  authHeader: z.boolean().optional(),
  models: z.array(modelDefSchema).min(1),
})

export const yangclawConfigSchema = z.object({
  models: z.object({
    mode: z.enum(['merge', 'replace']).optional(),
    providers: z.record(z.string(), providerSchema).refine((p) => Object.keys(p).length > 0, {
      message: 'models.providers must not be empty',
    }),
  }),
  agents: z
    .object({
      defaults: z
        .object({
          model: z
            .object({
              primary: z.string().min(1),
              fallbacks: z.array(z.string().min(1)).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  workspace: z.string().optional(),
})

export type ParsedYangclawConfig = z.infer<typeof yangclawConfigSchema>

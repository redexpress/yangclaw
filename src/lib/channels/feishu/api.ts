const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis'

// In-memory cache, refresh 5 minutes before expiry
let tokenCache: { token: string; expiresAt: number } | null = null

/**
 * Get Feishu tenant_access_token (with cache)
 */
export async function getFeishuAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  // Check if cache is still valid (refresh 5 minutes before expiry)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.token
  }

  const resp = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  })

  const data = await resp.json()

  if (data.code !== 0) {
    throw new Error(`Failed to get access token: ${data.msg}`)
  }

  tokenCache = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
  }

  return tokenCache.token
}

/**
 * Send Feishu text message
 */
export async function sendFeishuMessage(
  chatId: string,
  text: string,
  token: string
): Promise<void> {
  const resp = await fetch(
    `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text })
      })
    }
  )

  const data = await resp.json()

  if (data.code !== 0) {
    throw new Error(`Failed to send message: ${data.msg}`)
  }
}

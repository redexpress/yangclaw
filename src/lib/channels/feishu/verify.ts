import crypto from 'crypto'

/**
 * Verify Feishu signature
 *
 * Feishu signature algorithm:
 * 1. Compute HMAC-SHA256 of timestamp + body + app_secret
 * 2. Base64 encode the result
 * 3. Compare with the sign header
 */
export function verifyFeishuSignature(
  body: string,
  timestamp: string,
  sign: string,
  appSecret: string
): boolean {
  const stringToSign = timestamp + body + appSecret
  const hmac = crypto.createHmac('sha256', appSecret)
  hmac.update(stringToSign)
  const hash = hmac.digest('base64')
  return hash === sign
}

/**
 * Feishu event subscription GET request verification
 *
 * When configuring Feishu webhook, it first sends a GET request to verify URL availability
 * The request has a challenge parameter, just return the challenge
 */
export function handleFeishuChallenge(query: {
  challenge?: string
  token?: string
  type?: string
}): Response | null {
  if (query.challenge) {
    return Response.json({
      challenge: query.challenge
    })
  }
  return null
}

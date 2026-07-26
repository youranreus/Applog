import type { IVisitorCursorIdentity } from '@applog/common'

const VISITOR_CURSOR_SESSION_KEY = 'applog.visitor-cursor.identity'
const VISITOR_CURSOR_CHANNEL_NAME = 'applog.visitor-cursor.identity-claim'
const VISITOR_CURSOR_CLAIM_WAIT_MS = 60

const VISITOR_CURSOR_COLORS = [
  '#A23B72',
  '#2F6B5F',
  '#8A4F2D',
  '#5A4FA3',
  '#B33A3A',
  '#3E6680',
  '#6B5E20',
  '#8C3D66',
] as const

interface IVisitorCursorIdentityClaim {
  identity: IVisitorCursorIdentity
  release: () => void
}

interface IIdentityProbeMessage {
  type: 'probe'
  probeId: string
  visitorKey: string
}

interface IIdentityCollisionMessage {
  type: 'collision'
  probeId: string
}

type IdentityChannelMessage = IIdentityProbeMessage | IIdentityCollisionMessage

function isVisitorCursorIdentity(value: unknown): value is IVisitorCursorIdentity {
  if (!value || typeof value !== 'object') {
    return false
  }

  const identity = value as Record<string, unknown>
  return (
    typeof identity.visitorKey === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identity.visitorKey,
    ) &&
    typeof identity.displayId === 'string' &&
    /^[0-9A-F]{4}$/.test(identity.displayId) &&
    typeof identity.color === 'string' &&
    VISITOR_CURSOR_COLORS.includes(identity.color as (typeof VISITOR_CURSOR_COLORS)[number])
  )
}

function isIdentityChannelMessage(value: unknown): value is IdentityChannelMessage {
  if (!value || typeof value !== 'object') {
    return false
  }
  const message = value as Record<string, unknown>
  return (
    (message.type === 'probe' &&
      typeof message.probeId === 'string' &&
      typeof message.visitorKey === 'string') ||
    (message.type === 'collision' && typeof message.probeId === 'string')
  )
}

function createRandomIdentity(): IVisitorCursorIdentity {
  const randomValues = crypto.getRandomValues(new Uint32Array(2))
  const [displaySeed = 0, colorSeed = 0] = randomValues
  const displayId = (displaySeed & 0xffff).toString(16).padStart(4, '0').toUpperCase()
  const color =
    VISITOR_CURSOR_COLORS[colorSeed % VISITOR_CURSOR_COLORS.length] ?? VISITOR_CURSOR_COLORS[0]

  return {
    visitorKey: crypto.randomUUID(),
    displayId,
    color,
  }
}

function storeIdentity(identity: IVisitorCursorIdentity): void {
  try {
    sessionStorage.setItem(VISITOR_CURSOR_SESSION_KEY, JSON.stringify(identity))
  } catch {
    // 隐私模式可能禁用 sessionStorage，内存身份仍可继续工作。
  }
}

function getOrCreateStoredIdentity(): IVisitorCursorIdentity {
  try {
    const stored = sessionStorage.getItem(VISITOR_CURSOR_SESSION_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (isVisitorCursorIdentity(parsed)) {
        return parsed
      }
    }
  } catch {
    // 损坏数据或受限存储统一回退到新会话身份。
  }

  const identity = createRandomIdentity()
  storeIdentity(identity)
  return identity
}

/**
 * 领取当前标签页的访客鼠标身份。
 * BroadcastChannel 用于检测 opener 复制的 sessionStorage，保证同时打开的标签页不共用身份。
 * @returns 身份与卸载时的释放函数
 */
export async function claimVisitorCursorIdentity(): Promise<IVisitorCursorIdentityClaim> {
  let identity = getOrCreateStoredIdentity()
  if (typeof BroadcastChannel === 'undefined') {
    if (window.opener) {
      identity = createRandomIdentity()
      storeIdentity(identity)
    }
    return { identity, release: () => undefined }
  }

  const channel = new BroadcastChannel(VISITOR_CURSOR_CHANNEL_NAME)
  const probeId = crypto.randomUUID()
  let hasCollision = false

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isIdentityChannelMessage(event.data)) {
      return
    }
    if (event.data.type === 'probe' && event.data.visitorKey === identity.visitorKey) {
      channel.postMessage({
        type: 'collision',
        probeId: event.data.probeId,
      } satisfies IIdentityCollisionMessage)
      return
    }
    if (event.data.type === 'collision' && event.data.probeId === probeId) {
      hasCollision = true
    }
  })

  channel.postMessage({
    type: 'probe',
    probeId,
    visitorKey: identity.visitorKey,
  } satisfies IIdentityProbeMessage)
  await new Promise<void>((resolve) => {
    setTimeout(resolve, VISITOR_CURSOR_CLAIM_WAIT_MS)
  })

  if (hasCollision) {
    identity = createRandomIdentity()
    storeIdentity(identity)
  }

  return {
    identity,
    release: () => channel.close(),
  }
}

import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { constants as fsConstants } from 'node:fs'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { createServer as createViteServer } from 'vite'

const frontendRoot = fileURLToPath(new URL('../..', import.meta.url))
const album = {
  id: 'album-1',
  folder: 'album-1',
  title: '测试相册',
  description: '浏览器回归测试',
  publishedAt: '2026-08-25T00:00:00.000Z',
  photoCount: 1,
  coverUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
}
const albums = [
  album,
  { ...album, id: 'album-2', folder: 'album-2', title: '测试相册二' },
  { ...album, id: 'album-3', folder: 'album-3', title: '测试相册三' },
]
const photo = {
  id: 'photo-1',
  albumId: album.id,
  title: '已返回的照片',
  description: null,
  displayUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  width: 4,
  height: 3,
  takenAt: null,
  publishedAt: album.publishedAt,
  latitude: null,
  longitude: null,
  storageState: 'ready',
}

let apiOrigin
let frontendOrigin
let apiServer
let viteServer
let chromeProcess
let chromeProfile
let cdp
let pageSessionId
let photoResponses = 0
let previousApiBaseUrl
let apiBaseUrlOverridden = false

function restful(data) {
  return JSON.stringify({ code: 0, data, msg: 'ok' })
}

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

async function withTimeout(promise, duration, message) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), duration)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function waitFor(check, message, timeout = 8_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    try {
      const value = await check()
      if (value) return value
    } catch {
      // 页面导航期间允许短暂的执行上下文切换。
    }
    await delay(50)
  }
  throw new Error(message)
}

async function findChrome() {
  const configured = [process.env.CHROME_PATH, process.env.GOOGLE_CHROME_BIN].filter(Boolean)
  const platformCandidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/local/bin/google-chrome',
      '/opt/google/chrome/chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
    win32: [
      process.env.PROGRAMFILES
        ? join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe')
        : null,
      process.env['PROGRAMFILES(X86)']
        ? join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe')
        : null,
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')
        : null,
    ],
  }
  const executableNames =
    process.platform === 'win32'
      ? ['chrome.exe', 'chromium.exe']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  const pathCandidates = (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .flatMap((directory) => executableNames.map((name) => join(directory, name)))
  const candidates = [
    ...configured,
    ...(platformCandidates[process.platform] ?? []),
    ...pathCandidates,
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK)
      return candidate
    } catch {
      // 继续探测下一个标准路径。
    }
  }
  throw new Error(
    `找不到 Chrome/Chromium。请通过 CHROME_PATH 或 GOOGLE_CHROME_BIN 指定可执行文件；已检查：${candidates.join(', ') || '当前平台无默认路径'}`,
  )
}

class PipeCdpClient {
  constructor(input, output) {
    this.input = input
    this.output = output
    this.nextId = 1
    this.pending = new Map()
    this.buffer = Buffer.alloc(0)
    this.handleData = (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      let separator = this.buffer.indexOf(0)
      while (separator >= 0) {
        const payload = this.buffer.subarray(0, separator).toString('utf8')
        this.buffer = this.buffer.subarray(separator + 1)
        if (payload) this.handleMessage(JSON.parse(payload))
        separator = this.buffer.indexOf(0)
      }
    }
    this.output.on('data', this.handleData)
  }

  handleMessage(message) {
    if (!message.id) return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.error) pending.reject(new Error(message.error.message))
    else pending.resolve(message.result)
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
    const message = sessionId ? { id, method, params, sessionId } : { id, method, params }
    this.input.write(`${JSON.stringify(message)}\0`)
    return result
  }

  close() {
    this.output.off('data', this.handleData)
    this.output.resume()
    this.input.end()
    for (const pending of this.pending.values()) pending.reject(new Error('CDP pipe 已关闭'))
    this.pending.clear()
  }
}

async function stopChrome() {
  if (!chromeProcess || chromeProcess.exitCode !== null) return
  let exitPromise = once(chromeProcess, 'exit')
  chromeProcess.kill('SIGTERM')
  try {
    await withTimeout(exitPromise, 2_000, 'Chrome SIGTERM 超时')
  } catch {
    if (chromeProcess.exitCode !== null) return
    exitPromise = once(chromeProcess, 'exit')
    chromeProcess.kill('SIGKILL')
    await withTimeout(exitPromise, 2_000, 'Chrome SIGKILL 后仍未退出')
  }
}

async function evaluate(expression) {
  const result = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    pageSessionId,
  )
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function setViewport(width, height) {
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: width <= 390 },
    pageSessionId,
  )
}

async function navigateToDetail(expectedPhotoResponses) {
  await cdp.send(
    'Page.navigate',
    { url: `${frontendOrigin}/gallery/${album.id}` },
    pageSessionId,
  )
  await waitFor(
    async () =>
      photoResponses === expectedPhotoResponses &&
      (await evaluate(`document.querySelector('.album-heading h1')?.textContent`)) === album.title &&
      (await evaluate(`Boolean(document.querySelector('.photo-tile'))`)),
    '相册详情未能在照片接口返回后渲染照片',
  )
  await waitFor(
    async () =>
      await evaluate(
        `getComputedStyle(document.querySelector('.global-loading')).display === 'none'`,
      ),
    '全局加载遮罩未按预期隐藏',
    3_000,
  )
}

async function inspectLayout(expectedColumns) {
  return evaluate(`(() => {
    const link = document.querySelector('.album-heading .gallery-back-link')
    const header = document.querySelector('.header-container')
    const page = document.querySelector('.gallery-detail-page')
    const grid = document.querySelector('.photo-grid')
    if (!link || !header || !page || !grid) return null
    const linkRect = link.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const x = linkRect.left + linkRect.width / 2
    const y = linkRect.top + linkRect.height / 2
    return {
      viewportWidth: window.innerWidth,
      expectedColumns: ${expectedColumns},
      columnCount: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      loadingShown: document.body.innerText.includes('正在读取照片'),
      photoRendered: Boolean(document.querySelector('.photo-tile')),
      backHrefPath: new URL(link.href).pathname,
      linkTop: linkRect.top,
      headerBottom: headerRect.bottom,
      pagePaddingTop: Number.parseFloat(getComputedStyle(page).paddingTop),
      hitTargetIsLink: link.contains(document.elementFromPoint(x, y)),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      clickPoint: { x, y }
    }
  })()`)
}

async function inspectAlbumList(expectedColumns) {
  await waitFor(
    async () => {
      const columns = await evaluate(`(() => {
        const grid = document.querySelector('.album-grid')
        return grid
          ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
          : 0
      })()`)
      return columns === expectedColumns
    },
    `相册列表未切换为 ${expectedColumns} 列`,
    2_000,
  )
  return evaluate(`(() => {
    const header = document.querySelector('.header-container')
    const page = document.querySelector('.gallery-page')
    const grid = document.querySelector('.album-grid')
    if (!header || !page || !grid) return null
    const headerRect = header.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    return {
      viewportWidth: window.innerWidth,
      columnCount: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      cardCount: grid.querySelectorAll('.album-card').length,
      contentTop: gridRect.top,
      headerBottom: headerRect.bottom,
      pagePaddingTop: Number.parseFloat(getComputedStyle(page).paddingTop),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth
    }
  })()`)
}

async function clickAt(point) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send(
      'Input.dispatchMouseEvent',
      { type, button: 'left', clickCount: 1, x: point.x, y: point.y },
      pageSessionId,
    )
  }
}

before(async () => {
  const chromePath = await findChrome()
  apiServer = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', '*')
    response.setHeader('Content-Type', 'application/json')
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }

    const path = new URL(request.url, apiOrigin).pathname
    if (path === '/gallery/status') response.end(restful({ enabled: true }))
    else if (path === '/gallery/albums') response.end(restful(albums))
    else if (path === `/gallery/albums/${album.id}/photos`) {
      photoResponses++
      response.end(restful({ items: [photo], nextCursor: null }))
    } else if (path === '/page/nav') response.end(restful([]))
    else if (path === '/analytics/tracker-config') {
      response.end(restful({ enabled: false, scriptUrl: '', websiteId: '' }))
    } else if (path.startsWith('/config/')) response.end(restful(null))
    else {
      response.statusCode = 404
      response.end(restful(null))
    }
  })
  apiServer.listen(0, '127.0.0.1')
  await once(apiServer, 'listening')
  const apiAddress = apiServer.address()
  apiOrigin = `http://127.0.0.1:${apiAddress.port}`

  previousApiBaseUrl = process.env.VITE_API_BASE_URL
  apiBaseUrlOverridden = true
  process.env.VITE_API_BASE_URL = apiOrigin
  viteServer = await createViteServer({
    root: frontendRoot,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  })
  await viteServer.listen()
  const frontendAddress = viteServer.httpServer.address()
  frontendOrigin = `http://127.0.0.1:${frontendAddress.port}`

  chromeProfile = await mkdtemp(join(tmpdir(), 'applog-gallery-chrome-'))
  chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-pipe',
      '--window-size=1440,1000',
      `--user-data-dir=${chromeProfile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] },
  )
  const chromeLaunchError = once(chromeProcess, 'error').then(([cause]) => {
    throw cause
  })
  chromeProcess.stderr.resume()
  cdp = new PipeCdpClient(chromeProcess.stdio[3], chromeProcess.stdio[4])

  const targets = await withTimeout(
    Promise.race([cdp.send('Target.getTargets'), chromeLaunchError]),
    5_000,
    'Chrome CDP pipe 未能启动',
  )
  const page = targets.targetInfos.find(
    (target) => target.type === 'page' && target.url === 'about:blank',
  )
  if (!page) throw new Error('Chrome 未创建用于回归测试的空白页面')
  const attached = await cdp.send('Target.attachToTarget', {
    targetId: page.targetId,
    flatten: true,
  })
  pageSessionId = attached.sessionId
  await cdp.send('Page.enable', {}, pageSessionId)
  await cdp.send('Runtime.enable', {}, pageSessionId)
}, { timeout: 20_000 })

after(async () => {
  const cleanupErrors = []
  async function attempt(cleanup) {
    try {
      await cleanup()
    } catch (cause) {
      cleanupErrors.push(cause)
    }
  }

  await attempt(async () => {
    if (!cdp) return
    await withTimeout(cdp.send('Browser.close'), 1_000, 'CDP Browser.close 超时').catch(() => {})
    cdp.close()
  })
  await attempt(stopChrome)
  await attempt(async () => {
    if (!viteServer) return
    const closing = viteServer.close()
    viteServer.httpServer?.closeAllConnections?.()
    await withTimeout(closing, 3_000, 'Vite 关闭超时')
  })
  await attempt(async () => {
    if (!apiServer?.listening) return
    const closing = new Promise((resolve) => apiServer.close(resolve))
    apiServer.closeAllConnections?.()
    await withTimeout(closing, 2_000, '模拟 API 关闭超时')
  })
  if (apiBaseUrlOverridden) {
    if (previousApiBaseUrl === undefined) delete process.env.VITE_API_BASE_URL
    else process.env.VITE_API_BASE_URL = previousApiBaseUrl
  }
  await attempt(async () => {
    if (chromeProfile) await rm(chromeProfile, { recursive: true, force: true })
  })

  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, '浏览器回归测试清理失败')
}, { timeout: 10_000 })

test('照片响应后结束加载，且桌面与移动布局可点击、无溢出', { timeout: 18_000 }, async () => {
  await setViewport(1440, 1000)
  await navigateToDetail(1)
  const desktop = await inspectLayout(3)
  assert.ok(desktop, '桌面详情布局缺少必要元素')
  assert.deepEqual(
    {
      viewportWidth: desktop.viewportWidth,
      columnCount: desktop.columnCount,
      loadingShown: desktop.loadingShown,
      photoRendered: desktop.photoRendered,
      backHrefPath: desktop.backHrefPath,
      topGapAtLeast24: desktop.linkTop - desktop.headerBottom >= 24,
      hitTargetIsLink: desktop.hitTargetIsLink,
      noHorizontalOverflow: desktop.noHorizontalOverflow,
    },
    {
      viewportWidth: 1440,
      columnCount: 3,
      loadingShown: false,
      photoRendered: true,
      backHrefPath: '/gallery',
      topGapAtLeast24: true,
      hitTargetIsLink: true,
      noHorizontalOverflow: true,
    },
  )
  await clickAt(desktop.clickPoint)
  await waitFor(
    async () => (await evaluate('window.location.pathname')) === '/gallery',
    '桌面视口真实坐标点击未返回相册列表',
    2_000,
  )

  const desktopList = await inspectAlbumList(3)
  assert.deepEqual(
    {
      viewportWidth: desktopList?.viewportWidth,
      columnCount: desktopList?.columnCount,
      cardCount: desktopList?.cardCount,
      topPaddingMatchesDetail:
        desktopList && Math.abs(desktopList.pagePaddingTop - desktop.pagePaddingTop) < 0.5,
      topPaddingAtLeast104: (desktopList?.pagePaddingTop ?? 0) >= 104,
      topGapAtLeast24: desktopList
        ? desktopList.contentTop - desktopList.headerBottom >= 24
        : false,
      noHorizontalOverflow: desktopList?.noHorizontalOverflow,
    },
    {
      viewportWidth: 1440,
      columnCount: 3,
      cardCount: 3,
      topPaddingMatchesDetail: true,
      topPaddingAtLeast104: true,
      topGapAtLeast24: true,
      noHorizontalOverflow: true,
    },
  )

  await setViewport(768, 900)
  const tabletList = await inspectAlbumList(2)
  assert.deepEqual(
    {
      viewportWidth: tabletList?.viewportWidth,
      columnCount: tabletList?.columnCount,
      topGapAtLeast24: tabletList
        ? tabletList.contentTop - tabletList.headerBottom >= 24
        : false,
      noHorizontalOverflow: tabletList?.noHorizontalOverflow,
    },
    {
      viewportWidth: 768,
      columnCount: 2,
      topGapAtLeast24: true,
      noHorizontalOverflow: true,
    },
  )

  await setViewport(390, 844)
  const mobileList = await inspectAlbumList(1)
  assert.deepEqual(
    {
      viewportWidth: mobileList?.viewportWidth,
      columnCount: mobileList?.columnCount,
      topGapAtLeast24: mobileList ? mobileList.contentTop - mobileList.headerBottom >= 24 : false,
      noHorizontalOverflow: mobileList?.noHorizontalOverflow,
    },
    {
      viewportWidth: 390,
      columnCount: 1,
      topGapAtLeast24: true,
      noHorizontalOverflow: true,
    },
  )

  await navigateToDetail(2)
  const mobile = await inspectLayout(1)
  assert.ok(mobile, '移动详情布局缺少必要元素')
  assert.deepEqual(
    {
      viewportWidth: mobile.viewportWidth,
      columnCount: mobile.columnCount,
      loadingShown: mobile.loadingShown,
      photoRendered: mobile.photoRendered,
      topPaddingMatchesList:
        mobileList && Math.abs(mobile.pagePaddingTop - mobileList.pagePaddingTop) < 0.5,
      topPaddingAtLeast104: mobile.pagePaddingTop >= 104,
      topGapAtLeast24: mobile.linkTop - mobile.headerBottom >= 24,
      hitTargetIsLink: mobile.hitTargetIsLink,
      noHorizontalOverflow: mobile.noHorizontalOverflow,
      photoRequestCount: photoResponses,
    },
    {
      viewportWidth: 390,
      columnCount: 1,
      loadingShown: false,
      photoRendered: true,
      topPaddingMatchesList: true,
      topPaddingAtLeast104: true,
      topGapAtLeast24: true,
      hitTargetIsLink: true,
      noHorizontalOverflow: true,
      photoRequestCount: 2,
    },
  )
  await clickAt(mobile.clickPoint)
  await waitFor(
    async () => (await evaluate('window.location.pathname')) === '/gallery',
    '移动视口真实坐标点击未返回相册列表',
    2_000,
  )
})

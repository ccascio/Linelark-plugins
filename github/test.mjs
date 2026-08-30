import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('./GitHub.linelarkplugin/main.js', import.meta.url), 'utf8')

let panel
const commands = new Map()
const opened = []
let settingsOpened = 0
let tokenStored = false
let remotes = []
let copied = []
let stored = null
// What the device-flow endpoints will say next, and what the plugin asked them.
let deviceReplies = []
const deviceCalls = []

const ok = output => Promise.resolve({ ok: true, output: output || '' })
const linelark = {
  addPanel(descriptor) { panel = descriptor },
  addCommand(id, title, handler) { commands.set(id, { title, handler }) },
  refreshPanels() {},
  log() {},
  folderRoot() { return '/repo' },
  filePath() { return '/repo/README.md' },
  openFile() {},
  openDiff() {},
  openURL(url) { opened.push(url) },
  openPluginSettings() { settingsOpened += 1 },
  hasSecret(name) { return name === 'token' && tokenStored },
  setSecret(name, value) {
    if (name !== 'token') { return 'undeclared' }
    stored = value
    tokenStored = true
    return null
  },
  clearSecret(name) {
    if (name !== 'token') { return 'undeclared' }
    stored = null
    tokenStored = false
    return null
  },
  copyToClipboard(text) { copied.push(text); return true },
  canReachNetwork() { return true },
  repoIsAvailable() { return true },
  repoRoot() { return '/repo' },
  repoHead() { return 'main' },
  repoTracking() { return null },
  repoFiles() { return [] },
  repoBranches() { return [{ name: 'main', current: true }] },
  repoRemotes() { return remotes.map(remote => ({ ...remote })) },
  repoLog() {
    return [{ sha: '0123456789abcdef', parents: [], subject: 'Initial', author: 'Test',
      date: '2026-08-30', refs: ['main'] }]
  },
  repoCanWrite() { return true },
  repoFetchAsync() { return ok() },
  repoPullAsync() { return ok() },
  repoPushAsync() { return ok() },
  repoStageAsync() { return ok() },
  repoUnstageAsync() { return ok() },
  repoCommitAsync() { return ok() },
  repoSwitchAsync() { return ok() },
  repoCreateBranchAsync() { return ok() },
  repoDiscardAsync() { return ok() },
  repoDiffAsync() { return Promise.resolve('') },
  repoAddRemoteAsync(name, url) {
    remotes.push({ name, url })
    return ok()
  },
  repoSetRemoteURLAsync(name, url) {
    remotes = remotes.map(remote => remote.name === name ? { name, url } : remote)
    return ok()
  },
  repoRemoveRemoteAsync(name) {
    remotes = remotes.filter(remote => remote.name !== name)
    return ok()
  },
  fetch({ url, method, body, headers }) {
    if (url.startsWith('https://github.com/')) {
      deviceCalls.push({ url, method, body, headers })
      const next = deviceReplies.shift()
      if (!next) { throw new Error('no scripted reply for ' + url) }
      // A reply may be a function, which is the only way a test can act on the plugin
      // while its polling loop is actually running.
      const answer = typeof next === 'function' ? next() : next
      return Promise.resolve({ ok: true, status: 200, body: JSON.stringify(answer) })
    }
    if (url.includes('/pulls?')) {
      return Promise.resolve({ ok: true, status: 200, body: JSON.stringify([{
        number: 7, title: 'Finish the client', html_url: 'https://github.com/acme/repo/pull/7',
        draft: false, state: 'open', updated_at: '2026-08-30T00:00:00Z',
        user: { login: 'octocat' }, head: { ref: 'main' }, base: { ref: 'main' }
      }]) })
    }
    return Promise.resolve({ ok: true, status: 200,
      body: JSON.stringify({ check_runs: [] }) })
  }
}

// Real, but immediate: the plugin sleeps between polls and the loop cannot be exercised
// at all if the callback never fires. Delays are collected so the poll interval — which
// GitHub dictates and `slow_down` raises — can be asserted rather than assumed.
const delays = []
vm.runInNewContext(source, {
  linelark,
  setTimeout(fn, ms) { delays.push(ms); queueMicrotask(fn); return delays.length },
  clearTimeout() {},
  queueMicrotask,
  console
}, { filename: 'GitHub.linelarkplugin/main.js' })

assert.ok(panel, 'the repository panel is registered')
assert.equal(commands.get('account')?.title, 'GitHub Account…')
assert.equal(commands.get('openRepository')?.title, 'Open Repository on GitHub')

const section = (nodes, id) => nodes.find(node => node.type === 'section' && node.id === id)

let nodes = panel.render()
assert.equal(section(nodes, 'remotes').title, 'Remotes · 0')
assert.equal(section(nodes, 'account').collapsed, false, 'missing credentials start expanded')

await panel.onSelect('action:token')
assert.equal(settingsOpened, 1)
await panel.onSelect('action:newToken')
assert.equal(opened.pop(), 'https://github.com/settings/personal-access-tokens/new')

await panel.onSubmit('addRemote', 'origin https://github.com/acme/repo.git')
assert.deepEqual(remotes, [{ name: 'origin', url: 'https://github.com/acme/repo.git' }])

await panel.onSelect('remote:origin')
nodes = panel.render()
let remoteSection = section(nodes, 'remotes')
assert.ok(remoteSection.children.some(node => node.type === 'field' && node.id === 'remoteURL'))

await panel.onSubmit('remoteURL', 'git@github.com:acme/repo.git')
assert.equal(remotes[0].url, 'git@github.com:acme/repo.git')

await panel.onSelect('action:github')
await new Promise(resolve => queueMicrotask(resolve))
await new Promise(resolve => queueMicrotask(resolve))
await panel.onSelect('pr:7')
assert.equal(opened.pop(), 'https://github.com/acme/repo/pull/7')

await panel.onSelect('removeRemote:origin')
assert.deepEqual(remotes, [])

tokenStored = true
nodes = panel.render()
assert.equal(section(nodes, 'account').collapsed, true, 'connected accounts start collapsed')


// MARK: - Signing in through the browser
//
// The device flow is the one part of this plugin with a loop in it, and the loop is driven
// by what a server says rather than by anything local — which makes it the part that cannot
// be checked by reading it. Every reply GitHub can send is scripted here, in the order it
// would arrive.

const codeReply = {
  device_code: 'dev-code-1', user_code: 'ABCD-1234', interval: 5, expires_in: 900,
  verification_uri: 'https://github.com/login/device'
}

// A pass through the whole flow: pending, then throttled, then approved.
tokenStored = false
stored = null
copied = []
deviceCalls.length = 0
delays.length = 0
deviceReplies = [
  codeReply,
  { error: 'authorization_pending' },
  { error: 'slow_down', interval: 7 },
  { access_token: 'gho_fromdeviceflow' }
]

opened.length = 0
await panel.onSelect('action:login')

// Signing in does not open anything. The code has to be on screen first — a browser tab
// asking for a code the user has not been shown yet is the bug this ordering exists for.
assert.deepEqual(opened, [], 'the sign-in click fetches the code, it does not open a browser')
assert.equal(copied[0], 'ABCD-1234', 'the code the user has to retype goes to the clipboard')
assert.equal(stored, 'gho_fromdeviceflow', 'the token is filed as a secret, not kept here')
assert.ok(tokenStored)

assert.match(deviceCalls[0].url, /\/login\/device\/code$/)
assert.match(deviceCalls[0].body, /client_id=Ov23li1VRpexHTDxwLsY/)
assert.match(deviceCalls[0].body, /scope=repo/)
assert.equal(deviceCalls[0].headers.Accept, 'application/json',
  'without this GitHub answers form-encoded and JSON.parse throws')
assert.equal(deviceCalls.length, 4)
assert.match(deviceCalls[1].body, /device_code=dev-code-1/)
assert.match(deviceCalls[1].body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code/)
// The trailing 4000 is the outcome line clearing itself once the sign-in has landed.
assert.deepEqual(delays, [5000, 5000, 7000, 4000],
  'slow_down raises the interval to the one GitHub sent')

// Nothing anywhere in the plugin holds the token afterwards. It went to the host and the
// host is the only thing that can send it — which is the whole point of doing it this way
// rather than keeping it in the plugin store.
assert.ok(!JSON.stringify(panel.render()).includes('gho_fromdeviceflow'))

// The four-node shape does not move, whatever the section is saying. The commit box lives
// in this same panel and a node's identity is its position in the list.
const accountChildren = () => section(panel.render(), 'account').children
assert.equal(accountChildren().length, 4, 'signed in')

// Signing out puts it back, and takes the credential with it.
await panel.onSelect('action:signOut')
assert.equal(stored, null)
assert.equal(tokenStored, false)
assert.equal(accountChildren().length, 4, 'signed out')

// Cancelling stops the polling loop rather than leaving it running against a dead code.
// The cancel is delivered from inside a reply, which is the only moment the loop is live.
let midFlight = null
deviceCalls.length = 0
deviceReplies = [
  codeReply,
  () => {
    midFlight = accountChildren()
    // The second click is what opens the browser, and it is a user action of its own —
    // which is the only reason `openURL` is still allowed to work this late in the flow.
    panel.onSelect('action:openDevicePage')
    panel.onSelect('action:cancelSignIn')
    return { error: 'authorization_pending' }
  }
]
await panel.onSelect('action:login')
assert.equal(deviceCalls.length, 2, 'no further polling after the attempt is dropped')
assert.equal(midFlight.length, 4, 'waiting for a code')
assert.match(midFlight[0].text, /ABCD-1234/, 'the code is on screen, not only on the clipboard')
assert.equal(midFlight[1].id, 'action:openDevicePage')
assert.equal(midFlight[1].prominent, true, 'opening the page is the one obvious next step')
assert.equal(accountChildren().length, 4, 'cancelled')
assert.equal(opened.pop(), 'https://github.com/login/device',
  'the page opened is the one GitHub named in its reply')
assert.equal(copied.pop(), 'ABCD-1234',
  'the code is put back on the clipboard as the page opens, whatever was copied since')

// The same button means the credential screen once somebody is signed in. Starting a
// second device flow from it would be a sign-in nobody asked for.
tokenStored = true
deviceCalls.length = 0
const settingsBefore = settingsOpened
await panel.onSelect('action:login')
assert.equal(settingsOpened, settingsBefore + 1)
assert.equal(deviceCalls.length, 0, 'no device code is requested for an account already in')
tokenStored = false

// A refusal is reported rather than swallowed: a sign-in that quietly failed looks exactly
// like one that worked, until the next request.
// A verification URL that is not GitHub's is not opened. The reply arrives over TLS from
// github.com, but it is still a URL this plugin did not write.
copied.length = 0
opened.length = 0
deviceReplies = [
  { ...codeReply, verification_uri: 'https://example.invalid/phish' },
  () => {
    panel.onSelect('action:openDevicePage')
    panel.onSelect('action:cancelSignIn')
    return { error: 'authorization_pending' }
  }
]
await panel.onSelect('action:login')
assert.equal(opened.pop(), 'https://github.com/login/device', 'falls back to the real page')

deviceReplies = [codeReply, { error: 'expired_token' }]
await panel.onSelect('action:login')
assert.match(accountChildren()[0].text, /expired/i)
assert.equal(tokenStored, false)

console.log('GitHub plugin tests passed')

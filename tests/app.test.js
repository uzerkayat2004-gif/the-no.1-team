/**
 * No. 1 Team — Full App E2E Test
 * Tests the app like a real user via the Vite dev server on localhost:5173
 * Selectors are based on actual App.jsx class names and structure.
 */

const { chromium } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

let browser, page

async function screenshot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`📸 Screenshot: ${file}`)
  return file
}

function log(msg) { console.log(`\n✅ ${msg}`) }
function warn(msg) { console.log(`⚠️  ${msg}`) }
function fail(msg) { console.log(`❌ ${msg}`) }

async function runTests() {
  console.log('\n═══════════════════════════════════════')
  console.log('  No. 1 Team — E2E App Test Suite')
  console.log('═══════════════════════════════════════\n')

  browser = await chromium.launch({ headless: false, slowMo: 300 })
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  page = await context.newPage()

  // Capture console errors from the app
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => consoleErrors.push(err.message))

  try {

    // ─────────────────────────────────────────
    // TEST 1: App loads
    // ─────────────────────────────────────────
    console.log('TEST 1: App loads at localhost:5173')
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await screenshot('01-home-screen')

    const title = await page.title()
    console.log(`  Page title: "${title}"`)

    // Complete first-run onboarding if this is a fresh browser profile.
    const onboarding = page.locator('.onboarding-screen')
    if (await onboarding.isVisible().catch(() => false)) {
      log('Onboarding visible — completing first-run setup')
      await page.getByRole('button', { name: /Get Started/i }).click()
      await page.getByRole('button', { name: /Test & Continue/i }).click()
      await page.getByRole('button', { name: /Continue/i }).click()
      await page.getByRole('button', { name: /Next/i }).click()
      await page.getByRole('button', { name: /Start Using No\. 1 Team/i }).click()
      await page.waitForTimeout(1000)
    }

    // Check the home screen has the main app structure
    const appDiv = page.locator('.app-container')
    const appVisible = await appDiv.isVisible().catch(() => false)
    if (appVisible) log('App loaded — .app-container visible')
    else fail('.app-container not found')

    // ─────────────────────────────────────────
    // TEST 2: Sidebar elements visible
    // ─────────────────────────────────────────
    console.log('\nTEST 2: Sidebar elements visible')

    const sidebar = page.locator('.sidebar')
    if (await sidebar.isVisible().catch(() => false)) log('Sidebar visible')
    else warn('Sidebar not found')

    const newBtn = page.locator('.btn-new-session').first()
    const newBtnVisible = await newBtn.isVisible().catch(() => false)
    if (newBtnVisible) {
      log('"New Session" button (.btn-new-session) visible')
    } else {
      fail('"New Session" button (.btn-new-session) not found')
      await screenshot('02-sidebar-issue')
    }

    const navFiles = page.locator('.sidebar-link').filter({ hasText: /Brain Files/i }).first()
    const navSettings = page.locator('.sidebar-link').filter({ hasText: /Settings/i }).first()
    const navAnalytics = page.locator('.sidebar-link').filter({ hasText: /Analytics/i }).first()

    if (await navFiles.isVisible().catch(() => false)) log('Nav: Brain Files visible')
    else warn('Nav: Brain Files not found')

    if (await navSettings.isVisible().catch(() => false)) log('Nav: Settings visible')
    else warn('Nav: Settings not found')

    if (await navAnalytics.isVisible().catch(() => false)) log('Nav: Analytics visible')
    else warn('Nav: Analytics not found')

    await screenshot('02-sidebar-check')

    // ─────────────────────────────────────────
    // TEST 3: Home view / Start Session
    // ─────────────────────────────────────────
    console.log('\nTEST 3: Home view and Start Session')

    const welcomeView = page.locator('.welcome-screen')
    const welcomeVisible = await welcomeView.isVisible().catch(() => false)
    if (welcomeVisible) {
      log('Welcome view (.welcome-screen) visible')
    } else {
      warn('.welcome-screen not visible — may already be in session')
      await screenshot('03-home-not-visible')
    }

    if (newBtnVisible) {
      await screenshot('03-home-view')
      await newBtn.click()
      await page.waitForTimeout(1500)
      log('Clicked "New Session" — session started')
    }

    await screenshot('03-after-session-start')

    // ─────────────────────────────────────────
    // TEST 4: Session view — General pipeline chat
    // ─────────────────────────────────────────
    console.log('\nTEST 4: Session view — General pipeline chat')

    const sessionHeader = page.locator('.session-header, .chat-header, [class*="session"]').filter({ hasText: /Session 1/i }).first()
    if (await sessionHeader.isVisible().catch(() => false)) log('Session 1 view visible')
    else warn('Session header not found')

    const msgInput = page.locator('.msg-input')
    const inputExists = await msgInput.isVisible().catch(() => false)
    if (inputExists) log('General message input (.msg-input) visible')
    else warn('.msg-input textarea not found')
    await screenshot('04-general-chat')

    // ─────────────────────────────────────────
    // TEST 5: Target selector dropdown
    // ─────────────────────────────────────────
    console.log('\nTEST 5: Target selector dropdown')
    const tagBtn = page.locator('.tag-btn')
    if (await tagBtn.isVisible().catch(() => false)) {
      await tagBtn.click()
      await page.waitForTimeout(300)
      const dropdown = page.locator('.tag-dropdown')
      if (await dropdown.isVisible().catch(() => false)) log('Target dropdown (.tag-dropdown) visible')
      else warn('Target dropdown did not open')
      await screenshot('05-target-dropdown')
      await page.keyboard.press('Escape').catch(() => {})
    } else {
      warn('.tag-btn not found')
    }

    // ─────────────────────────────────────────
    // TEST 6: Slash command menu
    // ─────────────────────────────────────────
    console.log('\nTEST 6: Slash command menu')
    if (inputExists) {
      await msgInput.fill('/')
      await page.waitForTimeout(500)
      const slashMenu = page.locator('.slash-menu')
      if (await slashMenu.isVisible().catch(() => false)) log('Slash command menu (.slash-menu) visible')
      else warn('Slash command menu not visible after typing /')
      await screenshot('06-slash-menu')
      await msgInput.fill('')
    }

    // ─────────────────────────────────────────
    // TEST 7: Send a message in General chat
    // ─────────────────────────────────────────
    console.log('\nTEST 7: Send a message in General chat')
    if (inputExists) {
      await msgInput.fill('Hello team! This is a test message from the automated test.')
      await page.waitForTimeout(300)
      await screenshot('07-message-typed')

      const sendBtn = page.locator('.btn-send')
      await sendBtn.click()
      await page.waitForTimeout(1000)
      await screenshot('07b-message-sent')
      log('Message typed and sent via .btn-send button')
    }

    // ─────────────────────────────────────────
    // TEST 8: Check message appears in chat feed
    // ─────────────────────────────────────────
    console.log('\nTEST 8: Message appears in chat feed')
    const bodyText = await page.locator('body').innerText().catch(() => '')
    if (bodyText.includes('test message')) log('Test message text found in page')
    else warn('Test message not visible in page')
    await screenshot('08-chat-feed')

    // ─────────────────────────────────────────
    // TEST 9: Brain Files view
    // ─────────────────────────────────────────
    console.log('\nTEST 9: Brain Files view via sidebar')
    await page.mouse.click(10, 10)
    await page.waitForTimeout(300)

    if (await navFiles.isVisible().catch(() => false)) {
      await navFiles.click({ force: true })
      await page.waitForTimeout(1000)
      log('Clicked "Brain Files" nav item')
      await screenshot('09-files-view')
    } else {
      warn('Brain Files nav not found')
      await screenshot('09-no-files-nav')
    }

    // ─────────────────────────────────────────
    // TEST 10: Settings view
    // ─────────────────────────────────────────
    console.log('\nTEST 10: Settings view via sidebar')
    if (await navSettings.isVisible().catch(() => false)) {
      await navSettings.click({ force: true })
      await page.waitForTimeout(800)
      log('Clicked "Settings" nav item')
      await screenshot('10-settings-view')
    } else {
      warn('Settings nav not found')
    }

    // ─────────────────────────────────────────
    // TEST 11: Analytics view
    // ─────────────────────────────────────────
    console.log('\nTEST 11: Analytics view via sidebar')
    if (await navAnalytics.isVisible().catch(() => false)) {
      await navAnalytics.click({ force: true })
      await page.waitForTimeout(800)
      log('Clicked "Analytics" nav item')
      await screenshot('11-analytics-view')
    } else {
      warn('Analytics nav not found')
    }

    // ─────────────────────────────────────────
    // TEST 12: Return to session view
    // ─────────────────────────────────────────
    console.log('\nTEST 12: Navigate back to session')
    const sessItem = page.locator('.session-card').filter({ hasText: /Session 1/i }).first()
    if (await sessItem.isVisible().catch(() => false)) {
      await sessItem.click({ force: true })
      await page.waitForTimeout(800)
      log('Clicked session item — returned to session view')
    } else {
      warn('Session item not found in sidebar')
    }
    await screenshot('12-back-to-session')

    // ─────────────────────────────────────────
    // TEST 15: Check for JS errors
    // ─────────────────────────────────────────
    console.log('\nTEST 15: JavaScript error check')
    if (consoleErrors.length === 0) {
      log('No JavaScript errors detected!')
    } else {
      fail(`${consoleErrors.length} JS error(s) found:`)
      consoleErrors.forEach((e, i) => console.log(`  ${i+1}. ${e.slice(0, 300)}`))
    }

    // ─────────────────────────────────────────
    // TEST 16: Responsive layout check
    // ─────────────────────────────────────────
    console.log('\nTEST 16: Layout at different sizes')
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(400)
    await screenshot('16-viewport-1200')

    await page.setViewportSize({ width: 1600, height: 900 })
    await page.waitForTimeout(400)
    await screenshot('16b-viewport-1600')
    log('Viewport resize checks done')

    // ─────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────
    console.log('\n═══════════════════════════════════════')
    console.log('  TEST COMPLETE')
    console.log('═══════════════════════════════════════')
    console.log(`  Screenshots saved to: ${SCREENSHOT_DIR}`)
    console.log(`  JS Errors found: ${consoleErrors.length}`)
    if (consoleErrors.length > 0) {
      console.log('  Errors:')
      consoleErrors.forEach((e, i) => console.log(`    ${i+1}. ${e.slice(0, 200)}`))
    }
    console.log('')

  } catch (err) {
    fail(`Test crashed: ${err.message}`)
    await screenshot('ERROR-crash').catch(() => {})
    console.error(err)
  } finally {
    await browser.close()
  }
}

runTests().catch(console.error)

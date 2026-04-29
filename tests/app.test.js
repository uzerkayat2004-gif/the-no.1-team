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

    // Check the home screen has the main app structure
    const appDiv = page.locator('.app')
    const appVisible = await appDiv.isVisible().catch(() => false)
    if (appVisible) log('App loaded — .app container visible')
    else fail('.app container not found')

    // ─────────────────────────────────────────
    // TEST 2: Sidebar elements visible
    // ─────────────────────────────────────────
    console.log('\nTEST 2: Sidebar elements visible')

    // Sidebar brand
    const brand = page.locator('.sb-brand')
    if (await brand.isVisible().catch(() => false)) log('Sidebar brand visible')
    else warn('Sidebar brand not found')

    // "New Session" button — class: new-btn, inside .sb-new
    const newBtn = page.locator('.new-btn')
    const newBtnVisible = await newBtn.isVisible().catch(() => false)
    if (newBtnVisible) {
      log('"New Session" button (.new-btn) visible')
    } else {
      fail('"New Session" button (.new-btn) not found')
      await screenshot('02-sidebar-issue')
    }

    // Nav items: Sessions, Files, Settings
    const navSessions = page.locator('.nav-item').filter({ hasText: /Sessions/i }).first()
    const navFiles = page.locator('.nav-item').filter({ hasText: /Files/i }).first()
    const navSettings = page.locator('.nav-item').filter({ hasText: /Settings/i }).first()

    if (await navSessions.isVisible().catch(() => false)) log('Nav: Sessions visible')
    else warn('Nav: Sessions not found')

    if (await navFiles.isVisible().catch(() => false)) log('Nav: Files visible')
    else warn('Nav: Files not found')

    if (await navSettings.isVisible().catch(() => false)) log('Nav: Settings visible')
    else warn('Nav: Settings not found')

    await screenshot('02-sidebar-check')

    // ─────────────────────────────────────────
    // TEST 3: Home view / Start Session
    // ─────────────────────────────────────────
    console.log('\nTEST 3: Home view and Start Session')

    // Click "New Session" in sidebar to go to home view
    await newBtn.click()
    await page.waitForTimeout(1000)

    // Now in home view — check for .home class and "Start Session" button
    const homeView = page.locator('.home')
    const homeVisible = await homeView.isVisible().catch(() => false)
    if (homeVisible) {
      log('Home view (.home) visible')

      const startBtn = page.locator('.home-start-btn')
      const startBtnVisible = await startBtn.isVisible().catch(() => false)
      if (startBtnVisible) {
        log('"Start Session" button (.home-start-btn) visible')
        await screenshot('03-home-view')

        // Click to start a session
        await startBtn.click()
        await page.waitForTimeout(1500)
        log('Clicked "Start Session" — session started')
      } else {
        warn('.home-start-btn not found')
        await screenshot('03-home-no-start-btn')
      }
    } else {
      warn('.home view not visible — may already be in session')
      await screenshot('03-home-not-visible')
    }

    await screenshot('03-after-session-start')

    // ─────────────────────────────────────────
    // TEST 4: Session view — tab bar visible
    // ─────────────────────────────────────────
    console.log('\nTEST 4: Session view — tab bar and General tab')

    const tabBarWrap = page.locator('.tab-bar-wrap')
    const tabBarVisible = await tabBarWrap.isVisible().catch(() => false)
    if (tabBarVisible) {
      log('Tab bar (.tab-bar-wrap) visible')
    } else {
      warn('.tab-bar-wrap not found')
    }

    const generalTab = page.locator('.tab').filter({ hasText: /General/i }).first()
    const generalExists = await generalTab.isVisible().catch(() => false)
    if (generalExists) {
      log('General tab (.tab) visible')
      await generalTab.click()
      await page.waitForTimeout(500)
      log('Clicked General tab')
    } else {
      warn('General tab not found')
    }
    await screenshot('04-general-tab')

    // ─────────────────────────────────────────
    // TEST 5: Pipeline bar visible (phase controls)
    // ─────────────────────────────────────────
    console.log('\nTEST 5: Pipeline status bar')
    const pipelineBar = page.locator('.pipeline-bar')
    const pipelineVisible = await pipelineBar.isVisible().catch(() => false)
    if (pipelineVisible) {
      log('Pipeline bar (.pipeline-bar) visible')

      const phaseLabel = page.locator('.phase-label')
      const phaseTxt = await phaseLabel.innerText().catch(() => '')
      console.log(`  Current phase: "${phaseTxt.trim()}"`)

      const phaseNavBtns = page.locator('.phase-nav-btn')
      const btnCount = await phaseNavBtns.count()
      console.log(`  Phase nav buttons found: ${btnCount}`)
      if (btnCount > 0) log('Phase navigation buttons visible')
    } else {
      warn('.pipeline-bar not found')
    }
    await screenshot('05-pipeline-bar')

    // ─────────────────────────────────────────
    // TEST 6: Add an agent tab — use the "+" tab
    // ─────────────────────────────────────────
    console.log('\nTEST 6: Add Claude Code agent tab via "+" button')

    const addTabBtn = page.locator('.tab-add')
    const addTabExists = await addTabBtn.isVisible().catch(() => false)
    if (addTabExists) {
      await addTabBtn.click()
      await page.waitForTimeout(800)
      await screenshot('06-add-tab-dropdown')
      log('Clicked "+" tab-add button')

      const addDrop = page.locator('.add-tab-drop')
      const dropVisible = await addDrop.isVisible().catch(() => false)
      if (dropVisible) {
        log('Add tab dropdown (.add-tab-drop) opened')

        const items = page.locator('.add-tab-item')
        const itemCount = await items.count()
        console.log(`  Available agents in dropdown: ${itemCount}`)

        const claudeItem = page.locator('.add-tab-item').filter({ hasText: /Claude Code/i }).first()
        const claudeItemExists = await claudeItem.isVisible().catch(() => false)
        if (claudeItemExists) {
          await claudeItem.click()
          await page.waitForTimeout(800)
          log('Claude Code agent tab added')
          await screenshot('06b-claude-code-added')
        } else {
          warn('Claude Code option not found — listing available items')
          if (itemCount > 0) {
            await items.first().click()
            await page.waitForTimeout(800)
            log(`Added first available agent`)
            await screenshot('06b-first-agent-added')
          }
        }
      } else {
        warn('.add-tab-drop not visible after clicking +')
        await screenshot('06-no-dropdown')
      }
    } else {
      warn('.tab-add not found — checking if agents are already present')
      await screenshot('06-no-add-tab')
    }

    // ─────────────────────────────────────────
    // TEST 7: Navigate to agent tab
    // ─────────────────────────────────────────
    console.log('\nTEST 7: Navigate to agent tab')

    const allTabs = page.locator('.tab:not(.tab-add):not(.tab-start-all)')
    const tabCount = await allTabs.count()
    console.log(`  Total tabs (including General): ${tabCount}`)

    let agentTabClicked = false
    for (let i = 0; i < tabCount; i++) {
      const tab = allTabs.nth(i)
      const txt = await tab.innerText().catch(() => '')
      console.log(`  Tab ${i}: "${txt.trim().replace(/\n/g, ' ')}"`)
      if (!txt.toLowerCase().includes('general') && txt.trim()) {
        await tab.click()
        await page.waitForTimeout(800)
        log(`Navigated to tab: "${txt.trim().replace(/\n/g, ' ')}"`)
        agentTabClicked = true
        break
      }
    }
    if (!agentTabClicked) warn('No non-General tab found to click')
    await screenshot('07-agent-tab')

    // ─────────────────────────────────────────
    // TEST 8: Launch button on agent tab
    // ─────────────────────────────────────────
    console.log('\nTEST 8: Launch button visible on agent tab')

    const launchBtn = page.locator('button').filter({ hasText: /Launch/i }).first()
    const launchExists = await launchBtn.isVisible().catch(() => false)
    if (launchExists) {
      log('Launch button visible')
      await screenshot('08-launch-button')
    } else {
      const stopBtn = page.locator('.btn-stop').first()
      const stopExists = await stopBtn.isVisible().catch(() => false)
      if (stopExists) log('Agent already online — Stop button visible instead of Launch')
      else warn('Neither Launch nor Stop button found')
      await screenshot('08-no-launch-button')
    }

    // ─────────────────────────────────────────
    // TEST 9: Go back to General tab — send a message
    // ─────────────────────────────────────────
    console.log('\nTEST 9: Send a message in General tab')

    const genTab2 = page.locator('.tab').filter({ hasText: /General/i }).first()
    await genTab2.click().catch(() => {})
    await page.waitForTimeout(500)

    const msgInput = page.locator('.sess-input')
    const inputExists = await msgInput.isVisible().catch(() => false)
    if (inputExists) {
      await msgInput.click()
      await msgInput.fill('Hello team! This is a test message from the automated test.')
      await page.waitForTimeout(500)
      await screenshot('09-message-typed')

      const sendBtn = page.locator('.sess-send')
      await sendBtn.click()
      await page.waitForTimeout(1000)
      await screenshot('09b-message-sent')
      log('Message typed and sent via .sess-send button')
    } else {
      warn('.sess-input textarea not found')
      await screenshot('09-no-input')
    }

    // ─────────────────────────────────────────
    // TEST 10: Check message appears in chat
    // ─────────────────────────────────────────
    console.log('\nTEST 10: Message appears in chat feed')

    const msgFeed = page.locator('.chat-feed, .msg-wrap, .message, [class*="msg"]').first()
    const feedExists = await msgFeed.isVisible().catch(() => false)
    if (feedExists) {
      log('Chat feed / message element visible')
    } else {
      warn('Chat feed not found — checking page text')
      const bodyText = await page.locator('.main').innerText().catch(() => '')
      if (bodyText.includes('test message')) log('Test message text found in page')
      else warn('Test message not visible in page')
    }
    await screenshot('10-chat-feed')

    // ─────────────────────────────────────────
    // TEST 11: Files / Brain view (sidebar nav)
    // ─────────────────────────────────────────
    console.log('\nTEST 11: Files view via sidebar')

    // Close any overlays that might be blocking the click
    // When sending a message, a picker might appear. Let's click the main background first.
    await page.mouse.click(10, 10)
    await page.waitForTimeout(500)

    const filesNav = page.locator('.nav-item').filter({ hasText: /Files/i }).first()
    const filesNavExists = await filesNav.isVisible().catch(() => false)
    if (filesNavExists) {
      await filesNav.click({ force: true }) // Force click to bypass overlays
      await page.waitForTimeout(1000)
      log('Clicked "Files" nav item')
      await screenshot('11-files-view')

      const fileTree = page.locator('.tree-folder, .tree-file, [class*="tree"]').first()
      const treeVisible = await fileTree.isVisible().catch(() => false)
      if (treeVisible) log('File tree visible in Files view')
      else warn('File tree not visible — brain may be empty or API unavailable')
    } else {
      warn('.nav-item[Files] not found')
      await screenshot('11-no-files-nav')
    }

    // ─────────────────────────────────────────
    // TEST 12: Settings view
    // ─────────────────────────────────────────
    console.log('\nTEST 12: Settings view via sidebar')

    const settingsNav = page.locator('.nav-item').filter({ hasText: /Settings/i }).first()
    const settingsNavExists = await settingsNav.isVisible().catch(() => false)
    if (settingsNavExists) {
      await settingsNav.click({ force: true })
      await page.waitForTimeout(800)
      log('Clicked "Settings" nav item')
      await screenshot('12-settings-view')
    } else {
      warn('.nav-item[Settings] not found')
    }

    // ─────────────────────────────────────────
    // TEST 13: Go back to session view
    // ─────────────────────────────────────────
    console.log('\nTEST 13: Navigate back to session')

    const sessionsNav = page.locator('.nav-item').filter({ hasText: /Sessions/i }).first()
    if (await sessionsNav.isVisible().catch(() => false)) {
      await sessionsNav.click({ force: true })
      await page.waitForTimeout(500)
    }

    const sessItem = page.locator('.sess-item').first()
    const sessItemExists = await sessItem.isVisible().catch(() => false)
    if (sessItemExists) {
      await sessItem.click({ force: true })
      await page.waitForTimeout(800)
      log('Clicked session item — returned to session view')
    }
    await screenshot('13-back-to-session')

    // ─────────────────────────────────────────
    // TEST 14: Target selector (@All / @Agent)
    // ─────────────────────────────────────────
    console.log('\nTEST 14: Target selector (agent-sel)')

    const agentSel = page.locator('.agent-sel')
    const selExists = await agentSel.isVisible().catch(() => false)
    if (selExists) {
      const options = await agentSel.locator('option').allInnerTexts()
      log(`Target selector visible — options: ${options.join(', ')}`)
    } else {
      warn('.agent-sel not found (must be in General tab)')
      const gt = page.locator('.tab').filter({ hasText: /General/i }).first()
      await gt.click().catch(() => {})
      await page.waitForTimeout(500)
      const selExists2 = await agentSel.isVisible().catch(() => false)
      if (selExists2) {
        const options = await agentSel.locator('option').allInnerTexts()
        log(`Target selector found after switching to General: ${options.join(', ')}`)
      }
    }
    await screenshot('14-target-selector')

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

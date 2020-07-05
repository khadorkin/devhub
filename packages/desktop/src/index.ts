import { app, shell } from 'electron'
import url from 'url'

import * as config from './config'
import * as helpers from './helpers'
import * as ipc from './ipc'
import { __DEV__ } from './libs/electron-is-dev'
import * as menu from './menu'
import * as tray from './tray'
import * as updater from './updater'
import * as window from './window'

function setupBrowserExtensions() {
  const {
    default: installExtension,
    REACT_DEVELOPER_TOOLS,
    REDUX_DEVTOOLS,
  } = require('electron-devtools-installer') // tslint:disable-line no-var-requires

  installExtension(REACT_DEVELOPER_TOOLS).catch(console.error)
  installExtension(REDUX_DEVTOOLS).catch(console.error)
}

export let forceQuit = false

function init() {
  app.setName('DevHub')
  // app.commandLine.appendSwitch('disable-renderer-backgrounding')

  const openAtLoginChangeCount = config.store.get(
    'openAtLoginChangeCount',
  ) as number
  if (!(openAtLoginChangeCount >= 1)) {
    ipc.emit('update-settings', { settings: 'openAtLogin', value: true })
  }

  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  app.addListener('second-instance', (event, argv, _workingDirectory) => {
    const mainWindow = window.getMainWindow()
    if (!mainWindow) return

    helpers.showWindow(mainWindow)

    app.emit('open-url', event, argv.pop() || '')
  })

  app.addListener('ready', () => {
    config.store.set(
      'launchCount',
      (config.store.get('launchCount', 0) as number) + 1,
    )

    helpers.registerAppSchema()

    tray.createTray()
    window.init()

    if (process.platform === 'darwin') {
      app.setAboutPanelOptions({
        applicationName: 'DevHub',
        applicationVersion: app.getVersion(),
        copyright: 'Copyright 2019',
        credits: 'Bruno Lemos',
        website: 'https://devhubapp.com/',
      })
    }

    if (__DEV__) {
      setupBrowserExtensions()
    } else {
      updater.init()

      let lastUpdaterMenuItem = menu.getUpdaterMenuItem()
      setInterval(() => {
        const newUpdaterMenuItem = menu.getUpdaterMenuItem()
        if (lastUpdaterMenuItem.label !== newUpdaterMenuItem.label) {
          lastUpdaterMenuItem = newUpdaterMenuItem
          menu.updateMenu()
        }
      }, 5000)
    }
  })

  app.addListener('before-quit', async () => {
    forceQuit = true
  })

  app.addListener('window-all-closed', async () => {
    if (updater.getUpdateInfo().state === 'update-downloaded') {
      try {
        const mainWindow = window.getMainWindow()
        if (mainWindow) await mainWindow.webContents.session.clearCache()
      } catch (error) {
        console.error(error)
      }
      app.quit()
      return
    }

    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.addListener('activate', () => {
    window.updateOrRecreateWindow()
  })

  app.addListener('web-contents-created', (_event, webContents) => {
    webContents.addListener(
      'new-window',
      (event, uri, _frameName, _disposition, _options) => {
        if (
          !helpers.isDefaultAppSchema() &&
          `${url.parse(uri).pathname || ''}`.startsWith('/github/oauth')
        )
          return

        event.preventDefault()

        if (uri.startsWith('javascript:') || uri.startsWith('about:blank'))
          return
        shell.openExternal(uri)
      },
    )
  })

  app.addListener('open-url', (_event, uri) => {
    const mainWindow = window.getMainWindow()
    if (!mainWindow) return

    mainWindow.webContents.send('open-url', uri)
    helpers.showWindow(mainWindow)
  })

  ipc.register()

  updater.register()
}

init()

import { ipcMain, shell, clipboard, dialog } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

/**
 * Register all IPC handlers for the main process.
 * @param {Electron.BrowserWindow} mainWindow - The main application window
 */
export function registerIpcHandlers(mainWindow) {
  // Open external URL in default browser
  ipcMain.handle('open-url', async (_event, url) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Write text to clipboard
  ipcMain.handle('clipboard-write', (_event, text) => {
    clipboard.writeText(text)
    return { success: true }
  })

  // Read text from clipboard
  ipcMain.handle('clipboard-read', () => {
    return { success: true, text: clipboard.readText() }
  })

  // Show native open-file dialog
  // NOTE: added 'multiSelections' to properties so I can select multiple files at once
  ipcMain.handle('dialog-open-file', async (_event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      ...options,
    })
    return result
  })

  // Show native save dialog
  ipcMain.handle('dialog-save-file', async (_event, options = {}) => {
    const result = await dialog.showSaveDialog(mainWindow, options)
    return result
  })

  // Execute a shell command and return stdout/stderr
  // NOTE: bumped timeout to 60s because some adb commands (especially over wifi) can be slow
  // NOTE: also setting maxBuffer higher since some commands (like `adb logcat -d`) can dump a lot of output
  // NOTE: increased maxBuffer further to 20 MB — ran into truncation issues with logcat on my Pixel
  // NOTE: bumped timeout to 90s — 60s wasn't enough when pairing a new device over a slow network
  ipcMain.handle('exec-command', async (_event, command) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 90000,
        maxBuffer: 20 * 1024 * 1024, // 20 MB
      })
      return { success: true, stdout, stderr }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      }
    }
  })

  // Check if a file path exists
  ipcMain.handle('path-exists', (_event, filePath) => {
    return { exists: fs.existsSync(filePath) }
  })

  // Reveal a file or folder in the native file manager
  ipcMain.handle('show-item-in-folder', (_event, filePath) => {
    shell.showItemInFolder(path.normalize(filePath))
    return { success: true }
  })

  // Minimize the main window
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  // Maximize or restore the main window
  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  // Close the m
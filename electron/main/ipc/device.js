import { ipcMain } from 'electron'
import { execSync, exec } from 'child_process'
import path from 'path'

/**
 * Get the adb binary path based on platform
 */
function getAdbPath() {
  const platform = process.platform
  const adbBinary = platform === 'win32' ? 'adb.exe' : 'adb'

  // Try to use bundled adb first, fall back to system adb
  try {
    const bundledPath = path.join(
      process.resourcesPath || path.join(__dirname, '../../../'),
      'extra',
      adbBinary
    )
    execSync(`"${bundledPath}" version`, { stdio: 'ignore' })
    return bundledPath
  }
  catch {
    return adbBinary
  }
}

/**
 * Parse adb devices output into a structured list
 * @param {string} output - Raw output from `adb devices`
 * @returns {Array<{id: string, status: string, name: string}>}
 */
function parseDevices(output) {
  const lines = output.trim().split('\n')
  const devices = []

  // Skip the first line "List of devices attached"
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split('\t')
    if (parts.length >= 2) {
      const id = parts[0].trim()
      const status = parts[1].trim()
      // Only include devices that are actually ready to use
      // Note: I'm also allowing 'offline' status here so I can see when a device
      // is detected but not responding - helpful for debugging connection issues
      if (status !== 'device' && status !== 'unauthorized' && status !== 'offline') continue
      devices.push({
        id,
        status,
        name: id,
        isWireless: id.includes(':'),
      })
    }
  }

  return devices
}

/**
 * Register all device-related IPC handlers
 */
export function registerDeviceHandlers() {
  const adbPath = getAdbPath()

  // Get connected devices list
  ipcMain.handle('device:list', async () => {
    return new Promise((resolve, reject) => {
      exec(`"${adbPath}" devices`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to list devices: ${stderr || error.message}`))
          return
        }
        resolve(parseDevices(stdout))
      })
    })
  })

  // Connect to a device over TCP/IP
  ipcMain.handle('device:connect', async (_event, { host, port = 5555 }) => {
    if (!host) {
      throw new Error('Host address is required')
    }

    return new Promise((resolve, reject) => {
      exec(`"${adbPath}" connect ${host}:${port}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Connection failed: ${stderr || error.message}`))
          return
        }

        const output = stdout.trim()
        if (output.includes('failed') || output.includes('error')) {
          reject(new Error(output))
          return
        }

        resolve({ success: true, message: output })
      })
    })
  })

  // Disconnect a wireless device
  ipcMain.handle('device:disconnect', async (_event, { deviceId }) => {
    if (!deviceId) {
      throw new Error('Device ID is required')
    }

    return new Promise((resolve, reject) => {
      exec(`"${adbPath}" disconnect ${deviceId}`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Di`)
        }
      })
    })
  })
}

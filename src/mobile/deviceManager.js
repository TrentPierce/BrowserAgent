/**
 * Device Manager
 * Manages real devices and simulators/emulators
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DeviceManager {
    constructor() {
        this.devices = [];
        this.platform = null;
    }

    /**
     * List available Android devices/emulators
     */
    async listAndroidDevices() {
        try {
            const { stdout } = await execAsync('adb devices');
            const lines = stdout.split('\n').slice(1);
            
            const devices = [];
            for (const line of lines) {
                const match = line.match(/^([^\s]+)\s+device$/);
                if (match) {
                    const udid = match[1];
                    const model = await this.getAndroidDeviceModel(udid);
                    const version = await this.getAndroidVersion(udid);
                    
                    devices.push({
                        udid,
                        model,
                        version,
                        platform: 'android',
                        isEmulator: udid.startsWith('emulator-'),
                        status: 'available'
                    });
                }
            }
            
            return devices;
        } catch (error) {
            console.error('[DeviceManager] Failed to list Android devices:', error.message);
            return [];
        }
    }

    /**
     * List available iOS devices/simulators
     */
    async listIOSDevices() {
        try {
            const { stdout } = await execAsync('xcrun simctl list devices available --json');
            const data = JSON.parse(stdout);
            
            const devices = [];
            for (const [runtime, deviceList] of Object.entries(data.devices)) {
                const version = runtime.match(/iOS-([\d\.]+)/)?.[1] || 'unknown';
                
                for (const device of deviceList) {
                    if (device.state === 'Booted' || device.isAvailable) {
                        devices.push({
                            udid: device.udid,
                            model: device.name,
                            version,
                            platform: 'ios',
                            isSimulator: true,
                            status: device.state.toLowerCase()
                        });
                    }
                }
            }
            
            // Also check for real devices
            try {
                const { stdout: devicesStdout } = await execAsync('instruments -s devices');
                const realDevices = this.parseInstrumentsOutput(devicesStdout);
                devices.push(...realDevices);
            } catch (e) {
                // instruments command might not be available
            }
            
            return devices;
        } catch (error) {
            console.error('[DeviceManager] Failed to list iOS devices:', error.message);
            return [];
        }
    }

    /**
     * Parse instruments command output
     */
    parseInstrumentsOutput(output) {
        const devices = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(.+?)\s+\(([\d\.]+)\)\s+\[([A-F0-9-]+)\]/);
            if (match && !line.includes('Simulator')) {
                devices.push({
                    udid: match[3],
                    model: match[1].trim(),
                    version: match[2],
                    platform: 'ios',
                    isSimulator: false,
                    status: 'available'
                });
            }
        }
        
        return devices;
    }

    /**
     * Get Android device model
     */
    async getAndroidDeviceModel(udid) {
        try {
            const { stdout } = await execAsync(`adb -s ${udid} shell getprop ro.product.model`);
            return stdout.trim();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Get Android version
     */
    async getAndroidVersion(udid) {
        try {
            const { stdout } = await execAsync(`adb -s ${udid} shell getprop ro.build.version.release`);
            return stdout.trim();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * List all available devices (both platforms)
     */
    async listAllDevices() {
        const androidDevices = await this.listAndroidDevices();
        const iosDevices = await this.listIOSDevices();
        
        this.devices = [...androidDevices, ...iosDevices];
        return this.devices;
    }

    /**
     * Get device by UDID
     */
    async getDevice(udid) {
        if (this.devices.length === 0) {
            await this.listAllDevices();
        }
        
        return this.devices.find(d => d.udid === udid);
    }

    /**
     * Start Android emulator
     */
    async startAndroidEmulator(avdName) {
        try {
            console.log(`[DeviceManager] Starting Android emulator: ${avdName}`);
            exec(`emulator -avd ${avdName} -no-snapshot-load`);
            
            // Wait for emulator to boot
            await this.waitForAndroidEmulator();
            
            console.log('[DeviceManager] Android emulator started');
            return true;
        } catch (error) {
            console.error('[DeviceManager] Failed to start Android emulator:', error.message);
            return false;
        }
    }

    /**
     * Wait for Android emulator to boot
     */
    async waitForAndroidEmulator(maxWait = 120000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            try {
                const { stdout } = await execAsync('adb devices');
                if (stdout.includes('emulator-') && stdout.includes('device')) {
                    // Wait a bit more for full boot
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return true;
                }
            } catch (error) {
                // Continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Android emulator boot timeout');
    }

    /**
     * Start iOS simulator
     */
    async startIOSSimulator(udid) {
        try {
            console.log(`[DeviceManager] Starting iOS simulator: ${udid}`);
            await execAsync(`xcrun simctl boot ${udid}`);
            
            // Wait for simulator to boot
            await this.waitForIOSSimulator(udid);
            
            console.log('[DeviceManager] iOS simulator started');
            return true;
        } catch (error) {
            if (error.message.includes('state: Booted')) {
                // Already booted
                return true;
            }
            console.error('[DeviceManager] Failed to start iOS simulator:', error.message);
            return false;
        }
    }

    /**
     * Wait for iOS simulator to boot
     */
    async waitForIOSSimulator(udid, maxWait = 120000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            try {
                const { stdout } = await execAsync(`xcrun simctl list devices ${udid}`);
                if (stdout.includes('(Booted)')) {
                    return true;
                }
            } catch (error) {
                // Continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('iOS simulator boot timeout');
    }

    /**
     * Stop Android emulator
     */
    async stopAndroidEmulator(udid) {
        try {
            await execAsync(`adb -s ${udid} emu kill`);
            console.log('[DeviceManager] Android emulator stopped');
            return true;
        } catch (error) {
            console.error('[DeviceManager] Failed to stop Android emulator:', error.message);
            return false;
        }
    }

    /**
     * Stop iOS simulator
     */
    async stopIOSSimulator(udid) {
        try {
            await execAsync(`xcrun simctl shutdown ${udid}`);
            console.log('[DeviceManager] iOS simulator stopped');
            return true;
        } catch (error) {
            console.error('[DeviceManager] Failed to stop iOS simulator:', error.message);
            return false;
        }
    }

    /**
     * Install app on device
     */
    async installApp(udid, appPath, platform) {
        try {
            if (platform === 'android') {
                await execAsync(`adb -s ${udid} install ${appPath}`);
            } else if (platform === 'ios') {
                await execAsync(`xcrun simctl install ${udid} ${appPath}`);
            }
            console.log('[DeviceManager] App installed successfully');
            return true;
        } catch (error) {
            console.error('[DeviceManager] App installation failed:', error.message);
            return false;
        }
    }

    /**
     * Uninstall app from device
     */
    async uninstallApp(udid, packageId, platform) {
        try {
            if (platform === 'android') {
                await execAsync(`adb -s ${udid} uninstall ${packageId}`);
            } else if (platform === 'ios') {
                await execAsync(`xcrun simctl uninstall ${udid} ${packageId}`);
            }
            console.log('[DeviceManager] App uninstalled successfully');
            return true;
        } catch (error) {
            console.error('[DeviceManager] App uninstall failed:', error.message);
            return false;
        }
    }

    /**
     * Take screenshot
     */
    async takeScreenshot(udid, platform, outputPath) {
        try {
            if (platform === 'android') {
                await execAsync(`adb -s ${udid} exec-out screencap -p > ${outputPath}`);
            } else if (platform === 'ios') {
                await execAsync(`xcrun simctl io ${udid} screenshot ${outputPath}`);
            }
            return true;
        } catch (error) {
            console.error('[DeviceManager] Screenshot failed:', error.message);
            return false;
        }
    }
}

module.exports = DeviceManager;

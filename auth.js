// Handle optional dependency
let keytar;
try {
    keytar = require('keytar');
} catch (error) {
    console.warn('[Auth] keytar not installed. Secure credential storage will use fallback.');
    console.warn('[Auth] Install with: npm install keytar');
    keytar = null;
}

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'agentic-browser';
const ACCOUNT_NAME = 'database-encryption';
const SALT_FILE = path.join(__dirname, '.salt');

// In-memory fallback storage when keytar is not available
const fallbackStorage = new Map();

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.derivedKey = null;
        this.salt = null;
    }

    /**
     * Check if secure credential storage is available
     */
    static isSecureStorageAvailable() {
        return keytar !== null;
    }

    /**
     * Get or generate the salt for key derivation
     * Each installation gets a unique random salt
     */
    getSalt() {
        if (this.salt) return this.salt;

        try {
            if (fs.existsSync(SALT_FILE)) {
                this.salt = fs.readFileSync(SALT_FILE);
                if (this.salt.length === 32) {
                    return this.salt;
                }
            }
        } catch (error) {
            console.error('[Auth] Error reading salt file:', error.message);
        }

        // Generate new random salt
        this.salt = crypto.randomBytes(32);
        try {
            fs.writeFileSync(SALT_FILE, this.salt, { mode: 0o600 });
            console.log('[Auth] Generated new unique salt');
        } catch (error) {
            console.error('[Auth] Error saving salt:', error.message);
        }

        return this.salt;
    }

    async isPasswordSet() {
        try {
            if (keytar) {
                const passwordHash = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
                return passwordHash !== null;
            } else {
                // Fallback: check in-memory storage
                return fallbackStorage.has(`${SERVICE_NAME}:${ACCOUNT_NAME}`);
            }
        } catch (error) {
            console.error('[Auth] Error checking password:', error.message);
            return false;
        }
    }

    async setPassword(password) {
        // Validate password strength
        if (!this.validatePassword(password)) {
            throw new Error('Password must be at least 8 characters long');
        }

        try {
            // Hash the password for storage (separate from encryption key)
            const passwordHash = this.hashPassword(password);

            // Store hash in system keychain or fallback storage
            if (keytar) {
                await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, passwordHash);
            } else {
                fallbackStorage.set(`${SERVICE_NAME}:${ACCOUNT_NAME}`, passwordHash);
                console.warn('[Auth] Using fallback storage (keytar not available)');
            }

            this.derivedKey = this.deriveKey(password);
            this.isAuthenticated = true;

            console.log('[Auth] Password set successfully');
            return { success: true, derivedKey: this.derivedKey };
        } catch (error) {
            console.error('[Auth] Error setting password:', error.message);
            throw error;
        }
    }

    /**
     * Auto-login using stored credentials (no password prompt needed)
     * The derived key is regenerated from saved state
     */
    async autoLogin() {
        try {
            let storedHash;
            if (keytar) {
                storedHash = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            } else {
                storedHash = fallbackStorage.get(`${SERVICE_NAME}:${ACCOUNT_NAME}`);
            }
            
            if (!storedHash) {
                return { success: false, error: 'No credentials stored' };
            }

            // Use the stored hash itself as input to derive the encryption key
            // This allows auto-login without storing the actual password
            const salt = this.getSalt();
            this.derivedKey = crypto.pbkdf2Sync(
                storedHash, // Use the hash as the "password" for key derivation
                Buffer.concat([salt, Buffer.from('auto-encryption')]),
                100000,
                32,
                'sha256'
            ).toString('hex');

            this.isAuthenticated = true;
            console.log('[Auth] Auto-login successful');
            return { success: true, derivedKey: this.derivedKey };
        } catch (error) {
            console.error('[Auth] Auto-login failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Hash password for secure storage verification
     */
    hashPassword(password) {
        const salt = this.getSalt();
        return crypto.pbkdf2Sync(
            password,
            Buffer.concat([salt, Buffer.from('verification')]),
            100000,
            64,
            'sha512'
        ).toString('hex');
    }

    async verifyPassword(password) {
        try {
            let storedHash;
            if (keytar) {
                storedHash = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            } else {
                storedHash = fallbackStorage.get(`${SERVICE_NAME}:${ACCOUNT_NAME}`);
            }

            if (!storedHash) {
                return { success: false, error: 'No password set' };
            }

            // Hash the provided password and compare
            const inputHash = this.hashPassword(password);

            // Check if stored value is a valid 128-char hex hash (64 bytes as hex)
            const isHashFormat = storedHash.length === 128 && /^[a-f0-9]+$/i.test(storedHash);

            if (isHashFormat) {
                // New hash format - use timing-safe comparison
                try {
                    const inputBuffer = Buffer.from(inputHash, 'hex');
                    const storedBuffer = Buffer.from(storedHash, 'hex');

                    if (inputBuffer.length === storedBuffer.length &&
                        crypto.timingSafeEqual(inputBuffer, storedBuffer)) {
                        this.derivedKey = this.deriveKey(password);
                        this.isAuthenticated = true;
                        console.log('[Auth] Password verified successfully');
                        return { success: true, derivedKey: this.derivedKey };
                    }
                } catch (e) {
                    // Fall through to simple comparison
                }
            } else {
                // Old plaintext format - check and migrate
                if (password === storedHash) {
                    console.log('[Auth] Migrating from plaintext to hashed password');
                    // Upgrade to hashed format
                    if (keytar) {
                        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, inputHash);
                    } else {
                        fallbackStorage.set(`${SERVICE_NAME}:${ACCOUNT_NAME}`, inputHash);
                    }
                    this.derivedKey = this.deriveKey(password);
                    this.isAuthenticated = true;
                    return { success: true, derivedKey: this.derivedKey };
                }
            }

            return { success: false, error: 'Invalid password' };
        } catch (error) {
            console.error('[Auth] Error verifying password:', error.message);
            return { success: false, error: error.message };
        }
    }

    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return false;
        }
        return password.length >= 8;
    }

    deriveKey(password) {
        const salt = this.getSalt();
        // Use PBKDF2 to derive a strong encryption key
        return crypto.pbkdf2Sync(
            password,
            Buffer.concat([salt, Buffer.from('encryption')]),
            100000,
            32,
            'sha256'
        ).toString('hex');
    }

    getDerivedKey() {
        if (!this.isAuthenticated || !this.derivedKey) {
            throw new Error('Not authenticated');
        }
        return this.derivedKey;
    }

    async resetPassword() {
        try {
            if (keytar) {
                await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
            } else {
                fallbackStorage.delete(`${SERVICE_NAME}:${ACCOUNT_NAME}`);
            }
            // Also remove salt to start fresh
            if (fs.existsSync(SALT_FILE)) {
                fs.unlinkSync(SALT_FILE);
            }
            this.isAuthenticated = false;
            this.derivedKey = null;
            this.salt = null;
            console.log('[Auth] Password reset');
            return { success: true };
        } catch (error) {
            console.error('[Auth] Error resetting password:', error.message);
            throw error;
        }
    }

    logout() {
        this.isAuthenticated = false;
        this.derivedKey = null;
        console.log('[Auth] Logged out');
    }
}

module.exports = AuthManager;

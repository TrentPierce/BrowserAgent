// Handle optional dependency
let Database;
try {
    Database = require('better-sqlite3');
} catch (error) {
    console.warn('[Database] better-sqlite3 not installed. Database features will be unavailable.');
    console.warn('[Database] Install with: npm install better-sqlite3');
    Database = null;
}

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const SALT_FILE = path.join(__dirname, '.salt');

class SecureDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, 'agent_memory.db');
        this.db = null;
        this.encryptionKey = null;
    }

    /**
     * Check if database is available
     */
    static isAvailable() {
        return Database !== null;
    }

    /**
     * Get the shared salt from the salt file
     */
    getSalt() {
        try {
            if (fs.existsSync(SALT_FILE)) {
                const salt = fs.readFileSync(SALT_FILE);
                if (salt.length === 32) {
                    return salt;
                }
            }
        } catch (error) {
            console.error('[Database] Error reading salt file:', error.message);
        }

        // Generate new random salt if doesn't exist
        const salt = crypto.randomBytes(32);
        try {
            fs.writeFileSync(SALT_FILE, salt, { mode: 0o600 });
        } catch (error) {
            console.error('[Database] Error saving salt:', error.message);
        }
        return salt;
    }

    initialize(encryptionKey) {
        if (!Database) {
            throw new Error('better-sqlite3 is not installed. Install with: npm install better-sqlite3');
        }

        if (!encryptionKey || encryptionKey.length < 8) {
            throw new Error('Encryption key must be at least 8 characters');
        }

        this.encryptionKey = this.deriveKey(encryptionKey);

        try {
            // Open database (better-sqlite3 doesn't support SQLCipher natively)
            // We implement application-level encryption for sensitive fields
            this.db = new Database(this.dbPath);

            this.createTables();
            this.createIndexes();

            console.log('[Database] Secure database initialized successfully');
            return true;
        } catch (error) {
            console.error('[Database] Failed to initialize:', error.message);
            throw error;
        }
    }

    deriveKey(password) {
        const salt = this.getSalt();
        // Derive a 256-bit key from password using PBKDF2 with unique salt
        return crypto.pbkdf2Sync(
            password,
            Buffer.concat([salt, Buffer.from('database')]),
            100000,
            32,
            'sha256'
        ).toString('hex');
    }

    /**
     * Encrypt sensitive data before storing
     */
    encrypt(text) {
        if (!text || !this.encryptionKey) return text;

        const iv = crypto.randomBytes(16);
        const key = Buffer.from(this.encryptionKey, 'hex');
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Return IV + AuthTag + Encrypted data
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt sensitive data when reading
     */
    decrypt(encryptedText) {
        if (!encryptedText || !this.encryptionKey) return encryptedText;

        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 3) return encryptedText; // Not encrypted

            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];

            const key = Buffer.from(this.encryptionKey, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            // Return original if decryption fails (might be plain text)
            return encryptedText;
        }
    }

    createTables() {
        // Sessions table - stores high-level session info
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_uuid TEXT UNIQUE NOT NULL,
                goal TEXT NOT NULL,
                domain TEXT,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                status TEXT DEFAULT 'active',
                url_history TEXT,
                metadata TEXT
            )
        `);

        // Interactions table - stores every action with full context
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT NOT NULL,
                action_details TEXT,
                dom_state TEXT,
                screenshot_path TEXT,
                gemini_prompt TEXT,
                gemini_response TEXT,
                success BOOLEAN DEFAULT 0,
                error_message TEXT,
                user_feedback TEXT,
                retry_count INTEGER DEFAULT 0,
                execution_time_ms INTEGER,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        `);

        // Chat messages table - for inline chat history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sender TEXT NOT NULL,
                message TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                context TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        `);

        // Learned patterns table - for machine learning
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT NOT NULL,
                domain TEXT,
                selector_pattern TEXT,
                context_keywords TEXT,
                success_rate REAL DEFAULT 0,
                use_count INTEGER DEFAULT 0,
                average_execution_time_ms INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP,
                metadata TEXT
            )
        `);

        // User preferences table - learned user habits
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                preference_key TEXT NOT NULL,
                preference_value TEXT NOT NULL,
                confidence REAL DEFAULT 0.5,
                usage_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Challenges table - tracks difficult situations and resolutions
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                domain TEXT,
                challenge_type TEXT NOT NULL,
                description TEXT,
                attempted_solutions TEXT,
                resolution TEXT,
                user_guidance TEXT,
                success BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        `);
    }

    createIndexes() {
        // Performance indexes
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_domain ON patterns(domain)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_preferences_domain ON user_preferences(domain)`);
    }

    // Session management
    createSession(goal, domain = null) {
        const uuid = crypto.randomUUID();
        const stmt = this.db.prepare(`
            INSERT INTO sessions (session_uuid, goal, domain, status, start_time)
            VALUES (?, ?, ?, 'active', datetime('now'))
        `);
        // Encrypt sensitive goal data
        const result = stmt.run(uuid, this.encrypt(goal), domain);
        return { id: result.lastInsertRowid, uuid };
    }

    endSession(sessionId, status = 'completed') {
        if (!this.db) {
            console.warn('[Database] Cannot end session: database is closed');
            return;
        }
        const stmt = this.db.prepare(`
            UPDATE sessions 
            SET end_time = datetime('now'), status = ?
            WHERE id = ?
        `);
        stmt.run(status, sessionId);
    }

    getSession(sessionId) {
        const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
        if (session && session.goal) {
            session.goal = this.decrypt(session.goal);
        }
        return session;
    }

    getActiveSession() {
        const session = this.db.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY start_time DESC LIMIT 1").get();
        if (session && session.goal) {
            session.goal = this.decrypt(session.goal);
        }
        return session;
    }

    // Interaction logging
    logInteraction(sessionId, actionType, details) {
        const stmt = this.db.prepare(`
            INSERT INTO interactions 
            (session_id, action_type, action_details, dom_state, screenshot_path, 
             gemini_prompt, gemini_response, success, error_message, user_feedback, 
             retry_count, execution_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            sessionId,
            actionType,
            JSON.stringify(details.actionDetails || {}),
            details.domState || null,
            details.screenshotPath || null,
            details.geminiPrompt || null,
            details.geminiResponse || null,
            details.success ? 1 : 0,
            details.errorMessage || null,
            details.userFeedback || null,
            details.retryCount || 0,
            details.executionTimeMs || null
        );

        return result.lastInsertRowid;
    }

    updateInteractionSuccess(interactionId, success, feedback = null) {
        const stmt = this.db.prepare(`
            UPDATE interactions 
            SET success = ?, user_feedback = ?
            WHERE id = ?
        `);
        stmt.run(success ? 1 : 0, feedback, interactionId);
    }

    getSessionInteractions(sessionId, limit = 100) {
        return this.db.prepare(`
            SELECT * FROM interactions 
            WHERE session_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `).all(sessionId, limit);
    }

    // Chat message management
    addChatMessage(sessionId, sender, message, messageType = 'text', context = null) {
        const stmt = this.db.prepare(`
            INSERT INTO chat_messages (session_id, sender, message, message_type, context)
            VALUES (?, ?, ?, ?, ?)
        `);
        // Encrypt chat messages
        return stmt.run(sessionId, sender, this.encrypt(message), messageType, context ? JSON.stringify(context) : null).lastInsertRowid;
    }

    getChatHistory(sessionId, limit = 50) {
        const messages = this.db.prepare(`
            SELECT * FROM chat_messages 
            WHERE session_id = ? 
            ORDER BY timestamp ASC 
            LIMIT ?
        `).all(sessionId, limit);

        // Decrypt messages
        return messages.map(msg => ({
            ...msg,
            message: this.decrypt(msg.message)
        }));
    }

    searchChatHistory(sessionId, searchQuery, limit = 20) {
        // Note: Search works on encrypted data, so we need to decrypt and filter
        const allMessages = this.getChatHistory(sessionId, 1000);
        const lowerQuery = searchQuery.toLowerCase();

        return allMessages
            .filter(msg => msg.message.toLowerCase().includes(lowerQuery))
            .slice(0, limit);
    }

    // Pattern management
    recordPattern(patternType, domain, selectorPattern, contextKeywords, successRate = 1.0) {
        // Check if pattern exists
        const existing = this.db.prepare(`
            SELECT * FROM patterns 
            WHERE pattern_type = ? AND domain = ? AND selector_pattern = ?
        `).get(patternType, domain, selectorPattern);

        if (existing) {
            // Update existing pattern
            const stmt = this.db.prepare(`
                UPDATE patterns 
                SET success_rate = ((success_rate * use_count) + ?) / (use_count + 1),
                    use_count = use_count + 1,
                    last_used = datetime('now')
                WHERE id = ?
            `);
            stmt.run(successRate, existing.id);
            return existing.id;
        } else {
            // Create new pattern
            const stmt = this.db.prepare(`
                INSERT INTO patterns 
                (pattern_type, domain, selector_pattern, context_keywords, success_rate, use_count, last_used)
                VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
            `);
            return stmt.run(patternType, domain, selectorPattern, contextKeywords, successRate).lastInsertRowid;
        }
    }

    getPatternsForDomain(domain, patternType = null, minSuccessRate = 0.5) {
        let query = `
            SELECT * FROM patterns 
            WHERE domain = ? AND success_rate >= ?
        `;
        const params = [domain, minSuccessRate];

        if (patternType) {
            query += ' AND pattern_type = ?';
            params.push(patternType);
        }

        query += ' ORDER BY success_rate DESC, use_count DESC';

        return this.db.prepare(query).all(...params);
    }

    getTopPatterns(patternType, limit = 10) {
        return this.db.prepare(`
            SELECT * FROM patterns 
            WHERE pattern_type = ?
            ORDER BY success_rate DESC, use_count DESC 
            LIMIT ?
        `).all(patternType, limit);
    }

    // User preferences
    setPreference(domain, key, value, confidence = 0.5) {
        const existing = this.db.prepare(`
            SELECT * FROM user_preferences WHERE domain = ? AND preference_key = ?
        `).get(domain, key);

        if (existing) {
            const stmt = this.db.prepare(`
                UPDATE user_preferences 
                SET preference_value = ?, 
                    confidence = ((confidence * usage_count) + ?) / (usage_count + 1),
                    usage_count = usage_count + 1,
                    updated_at = datetime('now')
                WHERE id = ?
            `);
            stmt.run(value, confidence, existing.id);
        } else {
            const stmt = this.db.prepare(`
                INSERT INTO user_preferences (domain, preference_key, preference_value, confidence)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(domain, key, value, confidence);
        }
    }

    getPreference(domain, key) {
        return this.db.prepare(`
            SELECT * FROM user_preferences 
            WHERE domain = ? AND preference_key = ?
        `).get(domain, key);
    }

    getAllPreferencesForDomain(domain) {
        return this.db.prepare(`
            SELECT * FROM user_preferences WHERE domain = ?
        `).all(domain);
    }

    // Challenge tracking
    recordChallenge(sessionId, domain, challengeType, description, attemptedSolutions = []) {
        const stmt = this.db.prepare(`
            INSERT INTO challenges 
            (session_id, domain, challenge_type, description, attempted_solutions)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(
            sessionId,
            domain,
            challengeType,
            description,
            JSON.stringify(attemptedSolutions)
        ).lastInsertRowid;
    }

    resolveChallenge(challengeId, resolution, userGuidance, success) {
        const stmt = this.db.prepare(`
            UPDATE challenges 
            SET resolution = ?, user_guidance = ?, success = ?
            WHERE id = ?
        `);
        stmt.run(resolution, userGuidance, success ? 1 : 0, challengeId);
    }

    getSimilarChallenges(domain, challengeType, limit = 5) {
        return this.db.prepare(`
            SELECT * FROM challenges 
            WHERE domain = ? AND challenge_type = ? AND success = 1
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(domain, challengeType, limit);
    }

    // Analytics & insights
    getSessionStats(sessionId) {
        return this.db.prepare(`
            SELECT 
                COUNT(*) as total_actions,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_actions,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_actions,
                AVG(execution_time_ms) as avg_execution_time,
                MAX(retry_count) as max_retries
            FROM interactions 
            WHERE session_id = ?
        `).get(sessionId);
    }

    getDomainLearningStats(domain) {
        return this.db.prepare(`
            SELECT 
                COUNT(*) as total_patterns,
                AVG(success_rate) as avg_success_rate,
                SUM(use_count) as total_uses
            FROM patterns 
            WHERE domain = ?
        `).get(domain);
    }

    // Maintenance
    cleanupOldData(daysToKeep = 90) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);

        // Archive old sessions (mark as archived)
        const stmt = this.db.prepare(`
            UPDATE sessions 
            SET status = 'archived'
            WHERE start_time < ? AND status != 'active'
        `);
        const result = stmt.run(cutoff.toISOString());

        console.log(`[Database] Cleaned up ${result.changes} old sessions`);
        return result.changes;
    }

    /**
     * Purge sensitive data (DOM snapshots) from completed sessions
     */
    purgeSensitiveData(sessionId) {
        const stmt = this.db.prepare(`
            UPDATE interactions 
            SET dom_state = NULL, gemini_prompt = NULL
            WHERE session_id = ?
        `);
        stmt.run(sessionId);
    }

    compactDatabase() {
        this.db.exec('VACUUM');
        console.log('[Database] Database compacted');
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('[Database] Connection closed');
        }
    }
}

module.exports = SecureDatabase;

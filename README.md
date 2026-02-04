# 🤖 Generative Agentic Browser

An intelligent browser automation agent powered by Google Gemini that learns from user interactions, maintains persistent memory, and adapts to any website or challenge.

## ✨ Key Features

### 🔒 Secure Memory Storage
- **Encrypted SQLite Database**: All session data, learned patterns, and user preferences are stored in an encrypted database
- **Password Protection**: Minimum 8-character password required, stored securely in OS keychain
- **PBKDF2 Key Derivation**: 100,000 iterations for maximum security
- **AES-256-GCM Encryption**: Industry-standard encryption for all sensitive data

### 💬 Interactive Chat Interface
- **Inline Chat Overlay**: Fixed bottom panel for seamless communication
- **Real-time Messaging**: Agent can ask questions when it encounters challenges
- **Searchable History**: Search through all past conversations
- **Enter-to-Submit**: Quick message sending with Enter key
- **Typing Indicators**: Visual feedback when agent is "thinking"

### 🧠 Adaptive Learning System
- **Pattern Recognition**: Learns successful strategies for different websites
- **Cross-Domain Intelligence**: Applies learned patterns across similar sites
- **User Preference Learning**: Adapts to your specific browsing habits
- **Challenge Resolution**: Remembers how to overcome difficult scenarios

### 🔄 Smart Retry Logic
- **3-Attempt Retry**: Automatically retries failed actions with learned modifications
- **Escalating Delays**: 1s, 2s, 3s delays between retries
- **Strategy Adaptation**: Applies alternative approaches on subsequent attempts
- **User Escalation**: Asks for help after exhausting all retry options

### 📊 Session Intelligence
- **Persistent Sessions**: Resume tasks across browser restarts
- **Context Awareness**: Maintains full browsing context (URLs, DOM states, actions)
- **Progress Tracking**: Real-time success rate and statistics
- **Loop Detection**: Automatically detects and breaks out of infinite loops

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- Gemini API Key (get one at https://makersuite.google.com/app/apikey)

### Installation

1. **Clone and Install**
```bash
git clone <repository>
cd agentic-browser-gemini
npm install
```

2. **Configure API Key**
Create a `.env` file in the root directory:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

3. **Launch the Application**
```bash
npm start
```

4. **First-Time Setup**
- On first launch, you'll be prompted to create a password
- This password encrypts all your browsing data
- Minimum 8 characters required
- Password is stored securely in your OS keychain

## 📖 Usage Guide

### Starting a Task

1. Enter your goal in the "User Goal" text area
   - Example: "Go to Amazon and search for wireless headphones"
   - Example: "Fill out the contact form on example.com"

2. Navigate to your starting URL (optional)
   - The agent can also navigate automatically

3. Click "Start Agent"
   - The agent will begin analyzing the page
   - You'll see real-time logs in the Activity Log
   - Chat overlay will appear at the bottom

### During Task Execution

**Automatic Actions:**
- The agent captures screenshots and DOM state
- Analyzes the page with Gemini AI
- Executes actions (click, type, scroll, navigate)
- Learns from successful patterns

**When Help is Needed:**
- After 3 failed attempts, the agent will pause
- A question dialog will appear with options
- You can select an option or type custom guidance
- The agent learns from your response for future tasks

### Chat Interface

**Features:**
- **Search**: Click 🔍 to search chat history
- **Toggle**: Click − to collapse/expand chat
- **Unread Badge**: Shows new messages when collapsed
- **Auto-scroll**: Automatically scrolls to newest messages

**Message Types:**
- Agent messages (blue, left-aligned)
- User messages (pink, right-aligned)
- System messages (gray, centered)
- Option messages (numbered choices)

### Understanding the Stats

- **⏱️ Time**: Session duration
- **🤖 API Calls**: Number of Gemini API requests
- **🪙 Tokens**: Total tokens used
- **📊 Success Rate**: Percentage of successful actions
- **🧠 Learning**: Indicates active pattern learning

## 🧠 How Learning Works

### Pattern Recognition
The agent automatically learns:
- **Selector Patterns**: Which selectors work best on specific sites
- **Timing Preferences**: When to wait vs. act
- **Navigation Patterns**: Common site structures
- **Error Recovery**: How to handle specific error types

### Domain-Specific Learning
Each website gets its own learning profile:
- Successful action sequences
- Common element selectors
- Anti-bot detection patterns
- Optimal timing strategies

### Cross-Domain Intelligence
Learned patterns transfer across similar sites:
- E-commerce patterns work on multiple shopping sites
- Form patterns apply to various contact pages
- Navigation patterns help with similar layouts

### User Preference Learning
The agent adapts to your style:
- Preferred timing (fast vs. cautious)
- Handling of popups and modals
- Scroll behavior preferences
- Error tolerance levels

## 🔧 Advanced Features

### Session Persistence
- Sessions survive browser restarts
- Resume interrupted tasks
- All context preserved (DOM states, action history)
- Automatic cleanup of old data (90 days)

### Challenge Resolution
When the agent encounters difficulties:
1. **Retry with Modification**: Tries alternative selectors
2. **Context-Based Selection**: Uses page context to find elements
3. **User Guidance**: Asks for specific help
4. **Learning Update**: Updates patterns based on resolution

### Security Features
- **Encrypted at Rest**: All data encrypted on disk
- **Secure Key Storage**: Password in OS keychain, not in code
- **Memory Safety**: Sensitive data cleared from memory when possible
- **No Cloud Storage**: Everything stays local

## 📁 Project Structure

```
BrowserAgent/
├── main.js                 # Main Electron process
├── index.html             # Main UI
├── agent.js               # Base agent (legacy)
├── enhancedAgent.js       # Enhanced agent with learning
├── database.js            # Encrypted SQLite database
├── auth.js                # Password management
├── contextManager.js      # Session context tracking
├── learningEngine.js      # Pattern learning system
├── chatOverlay.js         # Inline chat interface
├── package.json           # Dependencies
├── .env                   # API key (create this)
└── agent_memory.db        # Encrypted database (created on first run)
```

## 🔌 IPC Events

### Main → Renderer
- `agent-log`: Log message for display
- `agent-stats`: Statistics update
- `agent-stopped`: Agent stopped notification
- `agent-question`: Question dialog display
- `chat-message`: New chat message
- `chat-search-results`: Search results

### Renderer → Main
- `start-agent`: Start agent with goal
- `stop-agent`: Stop current agent
- `chat-user-message`: User chat message
- `chat-search`: Search chat history

## 🛠️ Development

### Adding New Features

**Database Schema Updates:**
Edit `database.js` → `createTables()` method

**New Agent Capabilities:**
Edit `enhancedAgent.js` → Add methods to class

**UI Modifications:**
Edit `index.html` for layout
Edit `chatOverlay.js` for chat features

**Learning Algorithms:**
Edit `learningEngine.js` → `applyLearnedStrategies()`

### Debugging

Enable DevTools:
```javascript
// In main.js, uncomment:
mainWindow.webContents.openDevTools();
```

View Database:
```bash
# Use any SQLite viewer with the password
sqlite3 agent_memory.db
PRAGMA key = "x'<your-derived-key>'";
```

## 🐛 Troubleshooting

**"Invalid or missing GEMINI_API_KEY"**
- Check your `.env` file
- Ensure key is valid and active

**"Failed to initialize database"**
- Check password (minimum 8 characters)
- Ensure write permissions in directory

**Agent not asking questions**
- Retry logic triggers after 3 failures
- Check Activity Log for error messages

**Chat not appearing**
- Start agent first (chat initializes on agent start)
- Check browser console for errors

## 🔮 Future Enhancements

- [ ] Multi-language support
- [ ] Export/import learned data
- [ ] Visual action playback
- [ ] Custom strategy creation
- [ ] Plugin system for site-specific handlers
- [ ] Collaborative learning (opt-in)

## 📝 License

ISC License - See package.json

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚠️ Disclaimer

This tool is for educational and automation purposes. Always:
- Respect website Terms of Service
- Use responsibly and ethically
- Obtain proper authorization before automating
- Be mindful of rate limits and server resources

---

Built with ❤️ using Electron, Google Gemini, and lots of coffee.

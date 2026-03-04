// ============================================================
// 🦀 Krab — Advanced AGI Web Interface (TypeScript)
// ============================================================

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  avatar?: string;
}

interface Tool {
  id: string;
  name: string;
  icon: string;
  description: string;
  active?: boolean;
}

interface Stats {
  features: number;
  tools: string;
  providers: string;
  uptime: string;
}

interface ChatState {
  isConnected: boolean;
  isTyping: boolean;
  messages: Message[];
  currentTool: string;
}

interface KrabSettings {
  primaryModel: string;
  fallbackModels: string[];
  temperature: number;
  maxTokens: number;
  contextTokens: number;
  
  geminiApiKey: string;
  kilocodeApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  
  theme: 'dark' | 'light' | 'auto';
  language: string;
  notifications: boolean;
  
  autoSave: boolean;
  maxRetries: number;
  timeoutSeconds: number;
  
  allowFileUploads: boolean;
  requireApproval: boolean;
  auditLogging: boolean;
}

// ============================================================
// 🎨 UI Components
// ============================================================

class KrabWebInterface {
  private chatMessages!: HTMLElement;
  private messageInput!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private voiceButton!: HTMLButtonElement;
  private themeToggle!: HTMLButtonElement;
  private toolItems!: NodeListOf<HTMLElement>;
  private settingsModal!: HTMLElement;
  private settingsForm!: HTMLFormElement;
  
  private state: ChatState = {
    isConnected: true,
    isTyping: false,
    messages: [],
    currentTool: 'chat'
  };

  private settings: KrabSettings = {
    primaryModel: 'gemini-2.0-flash',
    fallbackModels: ['kilocode-glm-5', 'gpt-4'],
    temperature: 0.7,
    maxTokens: 4096,
    contextTokens: 4096,
    
    geminiApiKey: '',
    kilocodeApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    
    theme: 'dark',
    language: 'en',
    notifications: true,
    
    autoSave: true,
    maxRetries: 5,
    timeoutSeconds: 30,
    
    allowFileUploads: true,
    requireApproval: true,
    auditLogging: false
  };

  private tools: Tool[] = [
    { id: 'chat', name: 'Chat', icon: 'fas fa-comments', description: 'AI conversation' },
    { id: 'image', name: 'Image', icon: 'fas fa-image', description: 'Image generation' },
    { id: 'code', name: 'Code', icon: 'fas fa-code', description: 'Code execution' },
    { id: 'desktop', name: 'Desktop', icon: 'fas fa-desktop', description: 'Desktop control' },
    { id: 'web', name: 'Web', icon: 'fas fa-globe', description: 'Web browsing' },
    { id: 'voice', name: 'Voice', icon: 'fas fa-microphone', description: 'Voice processing' },
    { id: 'ai', name: 'AI', icon: 'fas fa-brain', description: 'AI models' },
    { id: 'security', name: 'Security', icon: 'fas fa-shield-alt', description: 'Security tools' }
  ];

  private stats: Stats = {
    features: 17,
    tools: '50+',
    providers: '15+',
    uptime: '99.9%'
  };

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.initializeChat();
    this.setupThemeToggle();
    this.initializeSettings();
    this.loadSettings();
  }

  private initializeElements(): void {
    this.chatMessages = document.getElementById('chatMessages')!;
    this.messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    this.sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    this.voiceButton = document.querySelector('.input-button[title="Voice input"]') as HTMLButtonElement;
    this.themeToggle = document.querySelector('.theme-toggle') as HTMLButtonElement;
    this.toolItems = document.querySelectorAll('.tool-item');
    this.settingsModal = document.getElementById('settingsModal')!;
    this.settingsForm = document.getElementById('settingsForm') as HTMLFormElement;
  }

  private setupEventListeners(): void {
    // Message input events
    this.messageInput.addEventListener('input', () => this.handleInputChange());
    this.messageInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
    
    // Button events
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.voiceButton.addEventListener('click', () => this.toggleVoiceInput());
    
    // Tool selection
    this.toolItems.forEach(tool => {
      tool.addEventListener('click', () => this.selectTool(tool));
    });

    // Settings events
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
    document.getElementById('settingsClose')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('settingsSave')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('settingsReset')?.addEventListener('click', () => this.resetSettings());

    // Auto-resize textarea
    this.messageInput.addEventListener('input', () => this.autoResizeTextarea());
  }

  private initializeChat(): void {
    // Add welcome message
    this.addMessage('assistant', `🦀 Hello! I'm Krab, your complete AGI assistant with 17 advanced features.

I can help you with:
🎨 **Creative tasks** - Image generation, voice processing
🖥️ **Automation** - Desktop control, web browsing, code execution  
🤝 **Collaboration** - Multi-agent coordination, task scheduling
📊 **Enterprise** - Analytics, security, cloud deployment

What would you like to accomplish today?`);
  }

  private setupThemeToggle(): void {
    this.themeToggle.addEventListener('click', () => {
      const currentTheme = this.settings.theme;
      this.settings.theme = currentTheme === 'dark' ? 'light' : 'dark';
      this.applyTheme();
      this.saveSettings();
    });
  }

  private applyTheme(): void {
    const theme = this.settings.theme;
    if (theme === 'light') {
      document.body.setAttribute('data-theme', 'light');
      this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      document.body.removeAttribute('data-theme');
      this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }

  private initializeSettings(): void {
    this.populateSettingsForm();
    this.applyTheme();
  }

  private populateSettingsForm(): void {
    // AI Configuration
    (document.getElementById('primaryModel') as HTMLSelectElement).value = this.settings.primaryModel;
    (document.getElementById('temperature') as HTMLInputElement).value = this.settings.temperature.toString();
    (document.getElementById('maxTokens') as HTMLInputElement).value = this.settings.maxTokens.toString();
    (document.getElementById('contextTokens') as HTMLInputElement).value = this.settings.contextTokens.toString();
    
    // API Keys
    (document.getElementById('geminiApiKey') as HTMLInputElement).value = this.settings.geminiApiKey;
    (document.getElementById('kilocodeApiKey') as HTMLInputElement).value = this.settings.kilocodeApiKey;
    (document.getElementById('openaiApiKey') as HTMLInputElement).value = this.settings.openaiApiKey;
    (document.getElementById('anthropicApiKey') as HTMLInputElement).value = this.settings.anthropicApiKey;
    
    // UI Settings
    (document.getElementById('theme') as HTMLSelectElement).value = this.settings.theme;
    (document.getElementById('language') as HTMLSelectElement).value = this.settings.language;
    (document.getElementById('notifications') as HTMLInputElement).checked = this.settings.notifications;
    
    // Performance
    (document.getElementById('autoSave') as HTMLInputElement).checked = this.settings.autoSave;
    (document.getElementById('maxRetries') as HTMLInputElement).value = this.settings.maxRetries.toString();
    (document.getElementById('timeoutSeconds') as HTMLInputElement).value = this.settings.timeoutSeconds.toString();
    
    // Security
    (document.getElementById('allowFileUploads') as HTMLInputElement).checked = this.settings.allowFileUploads;
    (document.getElementById('requireApproval') as HTMLInputElement).checked = this.settings.requireApproval;
    (document.getElementById('auditLogging') as HTMLInputElement).checked = this.settings.auditLogging;
  }

  private openSettings(): void {
    this.settingsModal.style.display = 'flex';
  }

  private closeSettings(): void {
    this.settingsModal.style.display = 'none';
  }

  private saveSettings(): void {
    try {
      // AI Configuration
      this.settings.primaryModel = (document.getElementById('primaryModel') as HTMLSelectElement).value;
      this.settings.temperature = parseFloat((document.getElementById('temperature') as HTMLInputElement).value);
      this.settings.maxTokens = parseInt((document.getElementById('maxTokens') as HTMLInputElement).value);
      this.settings.contextTokens = parseInt((document.getElementById('contextTokens') as HTMLInputElement).value);
      
      // API Keys
      this.settings.geminiApiKey = (document.getElementById('geminiApiKey') as HTMLInputElement).value;
      this.settings.kilocodeApiKey = (document.getElementById('kilocodeApiKey') as HTMLInputElement).value;
      this.settings.openaiApiKey = (document.getElementById('openaiApiKey') as HTMLInputElement).value;
      this.settings.anthropicApiKey = (document.getElementById('anthropicApiKey') as HTMLInputElement).value;
      
      // UI Settings
      this.settings.theme = (document.getElementById('theme') as HTMLSelectElement).value as 'dark' | 'light' | 'auto';
      this.settings.language = (document.getElementById('language') as HTMLSelectElement).value;
      this.settings.notifications = (document.getElementById('notifications') as HTMLInputElement).checked;
      
      // Performance
      this.settings.autoSave = (document.getElementById('autoSave') as HTMLInputElement).checked;
      this.settings.maxRetries = parseInt((document.getElementById('maxRetries') as HTMLInputElement).value);
      this.settings.timeoutSeconds = parseInt((document.getElementById('timeoutSeconds') as HTMLInputElement).value);
      
      // Security
      this.settings.allowFileUploads = (document.getElementById('allowFileUploads') as HTMLInputElement).checked;
      this.settings.requireApproval = (document.getElementById('requireApproval') as HTMLInputElement).checked;
      this.settings.auditLogging = (document.getElementById('auditLogging') as HTMLInputElement).checked;
      
      // Apply changes
      this.applyTheme();
      this.persistSettings();
      this.closeSettings();
      
      this.addMessage('assistant', '✅ Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.addMessage('assistant', '❌ Failed to save settings. Please check your input values.');
    }
  }

  private resetSettings(): void {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      this.settings = {
        primaryModel: 'gemini-2.0-flash',
        fallbackModels: ['kilocode-glm-5', 'gpt-4'],
        temperature: 0.7,
        maxTokens: 4096,
        contextTokens: 4096,
        
        geminiApiKey: '',
        kilocodeApiKey: '',
        openaiApiKey: '',
        anthropicApiKey: '',
        
        theme: 'dark',
        language: 'en',
        notifications: true,
        
        autoSave: true,
        maxRetries: 5,
        timeoutSeconds: 30,
        
        allowFileUploads: true,
        requireApproval: true,
        auditLogging: false
      };
      
      this.populateSettingsForm();
      this.applyTheme();
      this.persistSettings();
      this.addMessage('assistant', '🔄 Settings reset to defaults.');
    }
  }

  private loadSettings(): void {
    try {
      const savedSettings = localStorage.getItem('krabSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        this.settings = { ...this.settings, ...parsed };
        this.populateSettingsForm();
        this.applyTheme();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private persistSettings(): void {
    try {
      localStorage.setItem('krabSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
  }

  private handleInputChange(): void {
    // Enable/disable send button based on input
    this.sendButton.disabled = this.messageInput.value.trim().length === 0;
  }

  private handleKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private autoResizeTextarea(): void {
    this.messageInput.style.height = 'auto';
    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
  }

  private sendMessage(): void {
    const message = this.messageInput.value.trim();
    if (!message) return;

    // Add user message
    this.addMessage('user', message);
    
    // Clear input
    this.messageInput.value = '';
    this.messageInput.style.height = 'auto';
    this.sendButton.disabled = true;

    // Show typing indicator
    this.showTypingIndicator();

    // Simulate AI response
    setTimeout(() => {
      this.hideTypingIndicator();
      this.addMessage('assistant', this.generateAIResponse(message));
    }, 1500);
  }

  private toggleVoiceInput(): void {
    if (this.voiceButton.classList.contains('recording')) {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  private startVoiceRecording(): void {
    this.voiceButton.classList.add('recording');
    this.voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
    // TODO: Implement actual voice recording
    console.log('🎤 Voice recording started');
  }

  private stopVoiceRecording(): void {
    this.voiceButton.classList.remove('recording');
    this.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
    // TODO: Implement actual voice processing
    console.log('🎤 Voice recording stopped');
  }

  private selectTool(toolElement: HTMLElement): void {
    // Remove active class from all tools
    this.toolItems.forEach(t => t.classList.remove('active'));
    
    // Add active class to selected tool
    toolElement.classList.add('active');
    
    // Update current tool
    this.state.currentTool = toolElement.getAttribute('data-tool') || 'chat';
    
    console.log(`🔧 Tool selected: ${this.state.currentTool}`);
  }

  private addMessage(sender: 'user' | 'assistant', content: string): void {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const message: Message = {
      id: messageId,
      sender,
      content,
      timestamp,
      avatar: sender === 'user' ? 'fas fa-user' : 'fas fa-crab'
    };

    this.state.messages.push(message);
    this.renderMessage(message);
  }

  private renderMessage(message: Message): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const senderName = message.sender === 'user' ? 'You' : 'Krab AGI';
    
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <i class="${message.avatar}"></i>
      </div>
      <div class="message-content">
        <div class="message-header">
          <div class="message-sender">${senderName}</div>
          <div class="message-time">${message.timestamp}</div>
        </div>
        <div class="message-text">${message.content}</div>
      </div>
    `;

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private showTypingIndicator(): void {
    if (this.state.isTyping) return;
    
    this.state.isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    
    this.chatMessages.appendChild(typingDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private hideTypingIndicator(): void {
    this.state.isTyping = false;
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  private generateAIResponse(userMessage: string): string {
    const responses: Record<string, string> = {
      'image': '🎨 I can generate amazing images for you! What kind of image would you like me to create? I can do landscapes, portraits, abstract art, and more.',
      'code': '💻 I\'ll help you with coding! I can write, debug, and explain code in multiple languages. What programming task do you need help with?',
      'desktop': '🖥️ I can control your desktop! I can take screenshots, click buttons, type text, and automate tasks. What would you like me to do?',
      'web': '🌐 I can browse the web for you! I can navigate websites, extract information, fill forms, and automate web tasks. Where should I go?',
      'voice': '🎤 I can process voice! I can transcribe audio, generate speech, and work with multiple voice providers. What audio task can I help with?',
      'default': '🦀 I\'m here to help! I have 17 advanced features including image generation, code execution, desktop automation, web browsing, voice processing, and more. What specific task would you like me to help you with?'
    };

    const lowerMessage = userMessage.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (key !== 'default' && lowerMessage.includes(key)) {
        return response;
      }
    }
    return responses.default;
  }

  // Public API methods
  public getState(): ChatState {
    return { ...this.state };
  }

  public getTools(): Tool[] {
    return [...this.tools];
  }

  public getStats(): Stats {
    return { ...this.stats };
  }

  public getSettings(): KrabSettings {
    return { ...this.settings };
  }

  public clearChat(): void {
    this.state.messages = [];
    this.chatMessages.innerHTML = '';
    this.initializeChat();
  }

  public exportChat(): string {
    return JSON.stringify(this.state.messages, null, 2);
  }

  public updateSettings(newSettings: Partial<KrabSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.persistSettings();
    this.applyTheme();
  }
}

// ============================================================
// 🎨 Settings Modal HTML
// ============================================================

const settingsModalHTML = `
<div id="settingsModal" class="settings-modal" style="display: none;">
  <div class="settings-overlay" id="settingsClose"></div>
  <div class="settings-content">
    <div class="settings-header">
      <h2><i class="fas fa-cog"></i> Krab Settings</h2>
      <button class="settings-close-btn" id="settingsClose">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <form id="settingsForm" class="settings-form">
      <!-- AI Configuration -->
      <div class="settings-section">
        <h3><i class="fas fa-brain"></i> AI Configuration</h3>
        <div class="form-group">
          <label for="primaryModel">Primary Model</label>
          <select id="primaryModel" class="form-control">
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="kilocode-glm-5">Kilocode GLM-5</option>
            <option value="gpt-4">GPT-4</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="temperature">Temperature</label>
            <input type="range" id="temperature" class="form-control" min="0" max="2" step="0.1" value="0.7">
            <span class="range-value">0.7</span>
          </div>
          <div class="form-group">
            <label for="maxTokens">Max Tokens</label>
            <input type="number" id="maxTokens" class="form-control" min="100" max="8000" value="4096">
          </div>
        </div>
        
        <div class="form-group">
          <label for="contextTokens">Context Tokens</label>
          <input type="number" id="contextTokens" class="form-control" min="100" max="16000" value="4096">
        </div>
      </div>
      
      <!-- API Keys -->
      <div class="settings-section">
        <h3><i class="fas fa-key"></i> API Keys</h3>
        <div class="form-group">
          <label for="geminiApiKey">Gemini API Key</label>
          <input type="password" id="geminiApiKey" class="form-control" placeholder="Enter your Gemini API key">
        </div>
        
        <div class="form-group">
          <label for="kilocodeApiKey">Kilocode API Key</label>
          <input type="password" id="kilocodeApiKey" class="form-control" placeholder="Enter your Kilocode API key">
        </div>
        
        <div class="form-group">
          <label for="openaiApiKey">OpenAI API Key</label>
          <input type="password" id="openaiApiKey" class="form-control" placeholder="Enter your OpenAI API key">
        </div>
        
        <div class="form-group">
          <label for="anthropicApiKey">Anthropic API Key</label>
          <input type="password" id="anthropicApiKey" class="form-control" placeholder="Enter your Anthropic API key">
        </div>
      </div>
      
      <!-- UI Settings -->
      <div class="settings-section">
        <h3><i class="fas fa-palette"></i> UI Settings</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="theme">Theme</label>
            <select id="theme" class="form-control">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="language">Language</label>
            <select id="language" class="form-control">
              <option value="en">English</option>
              <option value="th">ไทย</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="notifications" checked>
            <span>Enable Notifications</span>
          </label>
        </div>
      </div>
      
      <!-- Performance -->
      <div class="settings-section">
        <h3><i class="fas fa-tachometer-alt"></i> Performance</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="maxRetries">Max Retries</label>
            <input type="number" id="maxRetries" class="form-control" min="1" max="10" value="5">
          </div>
          
          <div class="form-group">
            <label for="timeoutSeconds">Timeout (seconds)</label>
            <input type="number" id="timeoutSeconds" class="form-control" min="10" max="300" value="30">
          </div>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="autoSave" checked>
            <span>Auto-save Conversations</span>
          </label>
        </div>
      </div>
      
      <!-- Security -->
      <div class="settings-section">
        <h3><i class="fas fa-shield-alt"></i> Security</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="allowFileUploads" checked>
            <span>Allow File Uploads</span>
          </label>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="requireApproval" checked>
            <span>Require Approval for Dangerous Actions</span>
          </label>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="auditLogging">
            <span>Enable Audit Logging</span>
          </label>
        </div>
      </div>
    </form>
    
    <div class="settings-footer">
      <button type="button" class="btn btn-secondary" id="settingsReset">
        <i class="fas fa-undo"></i> Reset to Defaults
      </button>
      <div class="footer-actions">
        <button type="button" class="btn btn-outline" id="settingsClose">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button type="button" class="btn btn-primary" id="settingsSave">
          <i class="fas fa-save"></i> Save Settings
        </button>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================
// 🎨 Settings Modal Styles
// ============================================================

const settingsModalStyles = `
.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
}

.settings-content {
  position: relative;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow);
}

.settings-header {
  padding: 25px 30px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--card-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-close-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 24px;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.settings-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.settings-form {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.settings-section {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.02);
}

.settings-section h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.3s ease;
}

.form-control:focus {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(255, 255, 255, 0.08);
  outline: none;
}

.form-control[type="range"] {
  height: 6px;
  background: transparent;
  cursor: pointer;
}

.form-control[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-gradient);
  cursor: pointer;
}

.range-value {
  display: inline-block;
  margin-left: 10px;
  font-weight: 600;
  color: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 500;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-gradient);
}

.settings-footer {
  padding: 25px 30px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid var(--card-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-actions {
  display: flex;
  gap: 15px;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: var(--primary-gradient);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: rgba(244, 67, 54, 0.1);
  color: #F44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.btn-secondary:hover {
  background: rgba(244, 67, 54, 0.2);
}

.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--card-border);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 768px) {
  .settings-content {
    width: 95%;
    max-height: 95vh;
  }
  
  .settings-form {
    padding: 20px;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .settings-footer {
    flex-direction: column;
    gap: 15px;
  }
  
  .footer-actions {
    width: 100%;
    justify-content: space-between;
  }
}
`;

// ============================================================
// 🚀 Initialize Application
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Add settings modal to DOM
  const settingsContainer = document.createElement('div');
  settingsContainer.innerHTML = settingsModalHTML;
  document.body.appendChild(settingsContainer);
  
  // Add settings styles
  const style = document.createElement('style');
  style.textContent = settingsModalStyles;
  document.head.appendChild(style);
  
  const krabInterface = new KrabWebInterface();
  
  // Make interface available globally for debugging
  (window as any).krabInterface = krabInterface;
  
  // Add settings button to header
  const headerControls = document.querySelector('.header-controls')!;
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'settingsBtn';
  settingsBtn.className = 'theme-toggle';
  settingsBtn.innerHTML = '<i class="fas fa-cog"></i>';
  settingsBtn.title = 'Settings';
  headerControls.appendChild(settingsBtn);
  
  // Initialize temperature range display
  const temperatureInput = document.getElementById('temperature') as HTMLInputElement;
  const temperatureValue = temperatureInput.nextElementSibling as HTMLElement;
  
  temperatureInput.addEventListener('input', () => {
    temperatureValue.textContent = temperatureInput.value;
  });
  
  console.log('🦀 Krab Web Interface initialized successfully with settings panel');
});

// ============================================================
// 📚 Type Definitions
// ============================================================

declare global {
  interface Window {
    krabInterface: KrabWebInterface;
  }
}

export default KrabWebInterface;
export { Message, Tool, Stats, ChatState, KrabSettings };

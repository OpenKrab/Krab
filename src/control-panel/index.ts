// ============================================================
// 🦀 Krab — Web Control Panel
// ============================================================
import { channelRegistry } from "../channels/registry.js";
import { defaultStateManager } from "../persistence/messages.js";
import { logger } from "../utils/logger.js";

export interface ControlPanelConfig {
  title?: string;
  theme?: "light" | "dark" | "auto";
  refreshInterval?: number; // seconds
  maxMessagesPerPage?: number;
  enableRealTime?: boolean;
}

// ── Control Panel UI Generator ────────────────────────────────
export class ControlPanel {
  private config: ControlPanelConfig;

  constructor(config: ControlPanelConfig = {}) {
    this.config = {
      title: "🦀 Krab Control Panel",
      theme: "auto",
      refreshInterval: 30,
      maxMessagesPerPage: 50,
      enableRealTime: true,
      ...config
    };
  }

  // ── Main Control Panel Page ─────────────────────────────────
  getMainPage(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.title}</title>
    <style>${this.getStyles()}</style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>${this.config.title}</h1>
            <div class="header-actions">
                <button onclick="refreshAll()" class="btn btn-primary">🔄 Refresh</button>
                <button onclick="showSettings()" class="btn btn-secondary">⚙️ Settings</button>
            </div>
        </header>

        <nav class="nav">
            <a href="#channels" class="nav-link active" onclick="showSection('channels')">📡 Channels</a>
            <a href="#messages" class="nav-link" onclick="showSection('messages')">💬 Messages</a>
            <a href="#conversations" class="nav-link" onclick="showSection('conversations')">💭 Conversations</a>
            <a href="#analytics" class="nav-link" onclick="showSection('analytics')">📊 Analytics</a>
            <a href="#tools" class="nav-link" onclick="showSection('tools')">🛠️ Tools</a>
        </nav>

        <main class="main">
            <section id="channels-section" class="section active">
                <h2>📡 Channel Management</h2>
                <div id="channels-content">
                    <div class="loading">Loading channels...</div>
                </div>
            </section>

            <section id="messages-section" class="section">
                <h2>💬 Recent Messages</h2>
                <div class="filters">
                    <select id="channel-filter" onchange="filterMessages()">
                        <option value="">All Channels</option>
                    </select>
                    <input type="text" id="message-search" placeholder="Search messages..." onkeyup="filterMessages()">
                    <button onclick="clearFilters()" class="btn btn-secondary">Clear</button>
                </div>
                <div id="messages-content">
                    <div class="loading">Loading messages...</div>
                </div>
            </section>

            <section id="conversations-section" class="section">
                <h2>💭 Active Conversations</h2>
                <div id="conversations-content">
                    <div class="loading">Loading conversations...</div>
                </div>
            </section>

            <section id="analytics-section" class="section">
                <h2>📊 Analytics</h2>
                <div id="analytics-content">
                    <div class="loading">Loading analytics...</div>
                </div>
            </section>

            <section id="tools-section" class="section">
                <h2>🛠️ Tools & Testing</h2>
                <div class="tools-grid">
                    <div class="tool-card">
                        <h3>Channel Test</h3>
                        <p>Test message sending to channels</p>
                        <button onclick="showChannelTest()" class="btn btn-primary">Test Channels</button>
                    </div>
                    <div class="tool-card">
                        <h3>Message Search</h3>
                        <p>Advanced message search across all channels</p>
                        <button onclick="showMessageSearch()" class="btn btn-primary">Search</button>
                    </div>
                    <div class="tool-card">
                        <h3>Bulk Operations</h3>
                        <p>Bulk message operations and cleanup</p>
                        <button onclick="showBulkOperations()" class="btn btn-primary">Manage</button>
                    </div>
                </div>
            </section>
        </main>

        <footer class="footer">
            <div class="status-bar">
                <span id="last-updated">Last updated: <span id="update-time">-</span></span>
                <span id="connection-status">🟢 Connected</span>
            </div>
        </footer>
    </div>

    <!-- Modals -->
    <div id="modals"></div>

    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>`;
  }

  // ── Channel Management Section ──────────────────────────────
  private getChannelsContent(): string {
    return `
        <div class="channels-grid">
            <div class="channel-summary">
                <div class="metric">
                    <span class="metric-value" id="total-channels">0</span>
                    <span class="metric-label">Total Channels</span>
                </div>
                <div class="metric">
                    <span class="metric-value" id="active-channels">0</span>
                    <span class="metric-label">Active</span>
                </div>
                <div class="metric">
                    <span class="metric-value" id="total-messages">0</span>
                    <span class="metric-label">Messages</span>
                </div>
            </div>

            <div id="channel-list" class="channel-list">
                <!-- Channel cards will be populated here -->
            </div>
        </div>`;
  }

  // ── Messages Section ────────────────────────────────────────
  private getMessagesContent(): string {
    return `
        <div class="messages-container">
            <div class="messages-list" id="messages-list">
                <!-- Messages will be populated here -->
            </div>
            <div class="pagination">
                <button id="prev-page" onclick="changePage(-1)" disabled>Previous</button>
                <span id="page-info">Page 1</span>
                <button id="next-page" onclick="changePage(1)">Next</button>
            </div>
        </div>`;
  }

  // ── Analytics Section ───────────────────────────────────────
  private getAnalyticsContent(): string {
    return `
        <div class="analytics-grid">
            <div class="chart-card">
                <h3>📊 Message Distribution by Channel</h3>
                <canvas id="channel-chart" width="400" height="200"></canvas>
            </div>
            <div class="chart-card">
                <h3>📈 Message Types</h3>
                <canvas id="type-chart" width="400" height="200"></canvas>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Messages</h4>
                    <span class="stat-value" id="total-msg-stat">0</span>
                </div>
                <div class="stat-card">
                    <h4>Active Conversations</h4>
                    <span class="stat-value" id="active-conv-stat">0</span>
                </div>
                <div class="stat-card">
                    <h4>Average Response Time</h4>
                    <span class="stat-value" id="avg-response-stat">-</span>
                </div>
                <div class="stat-card">
                    <h4>Success Rate</h4>
                    <span class="stat-value" id="success-rate-stat">-</span>
                </div>
            </div>
        </div>`;
  }

  // ── CSS Styles ──────────────────────────────────────────────
  private getStyles(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: white;
            padding: 1rem 2rem;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .header h1 {
            color: #0f172a;
            font-size: 1.5rem;
        }

        .header-actions { display: flex; gap: 0.5rem; }

        .nav {
            background: white;
            padding: 0 2rem;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            gap: 2rem;
        }

        .nav-link {
            padding: 1rem 0;
            text-decoration: none;
            color: #64748b;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .nav-link:hover, .nav-link.active {
            color: #3b82f6;
            border-bottom-color: #3b82f6;
        }

        .main { flex: 1; padding: 2rem; }

        .section {
            display: none;
            animation: fadeIn 0.3s ease-in-out;
        }

        .section.active { display: block; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #64748b;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
        }

        .btn-primary {
            background: #3b82f6;
            color: white;
        }

        .btn-primary:hover { background: #2563eb; }

        .btn-secondary {
            background: #f1f5f9;
            color: #475569;
        }

        .btn-secondary:hover { background: #e2e8f0; }

        .btn-danger {
            background: #ef4444;
            color: white;
        }

        .btn-danger:hover { background: #dc2626; }

        /* Channel Management */
        .channels-grid { display: grid; gap: 2rem; }

        .channel-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .metric {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }

        .metric-value {
            display: block;
            font-size: 2rem;
            font-weight: bold;
            color: #3b82f6;
        }

        .metric-label { color: #64748b; font-size: 0.875rem; }

        .channel-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
        }

        .channel-card {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border-left: 4px solid #10b981;
        }

        .channel-card.inactive { border-left-color: #ef4444; }

        .channel-card h3 {
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .channel-status {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
        }

        .channel-status.inactive { background: #ef4444; }

        .channel-info { margin: 1rem 0; }

        .channel-info div {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.25rem;
        }

        .channel-actions { display: flex; gap: 0.5rem; }

        /* Messages */
        .filters {
            background: white;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            display: flex;
            gap: 1rem;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .filters select, .filters input {
            padding: 0.5rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
        }

        .messages-container { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        .message-item {
            padding: 1rem;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            gap: 1rem;
        }

        .message-item:last-child { border-bottom: none; }

        .message-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }

        .message-content { flex: 1; }

        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }

        .message-author { font-weight: 600; }
        .message-time { color: #64748b; font-size: 0.875rem; }
        .message-text { color: #374151; }

        .pagination {
            padding: 1rem;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
        }

        /* Analytics */
        .analytics-grid { display: grid; gap: 2rem; }

        .chart-card {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }

        .stat-card h4 { color: #64748b; margin-bottom: 0.5rem; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #3b82f6; }

        /* Tools */
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
        }

        .tool-card {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .tool-card h3 { margin-bottom: 0.5rem; }
        .tool-card p { color: #64748b; margin-bottom: 1rem; }

        /* Footer */
        .footer {
            background: white;
            padding: 1rem 2rem;
            border-top: 1px solid #e2e8f0;
            margin-top: auto;
        }

        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* Modals */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal-content {
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .header, .nav, .footer { padding: 1rem; }
            .nav { gap: 1rem; }
            .main { padding: 1rem; }
            .channel-list { grid-template-columns: 1fr; }
            .tools-grid { grid-template-columns: 1fr; }
        }
    `;
  }

  // ── JavaScript Functionality ────────────────────────────────
  private getJavaScript(): string {
    return `
        let currentSection = 'channels';
        let currentPage = 1;
        let currentFilters = {};

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            loadChannels();
            loadAnalytics();
            updateLastRefresh();

            // Auto refresh
            setInterval(refreshAll, ${this.config.refreshInterval} * 1000);
        });

        // Navigation
        function showSection(sectionName) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

            document.getElementById(sectionName + '-section').classList.add('active');
            event.target.classList.add('active');

            currentSection = sectionName;

            // Load section data
            switch(sectionName) {
                case 'messages':
                    loadMessages();
                    break;
                case 'conversations':
                    loadConversations();
                    break;
                case 'analytics':
                    loadAnalytics();
                    break;
            }
        }

        // Data Loading
        async function loadChannels() {
            try {
                const response = await fetch('/channels/status');
                const data = await response.json();

                updateChannelSummary(data);
                renderChannelList(data.channels);
            } catch (error) {
                console.error('Failed to load channels:', error);
                document.getElementById('channels-content').innerHTML =
                    '<div class="error">Failed to load channels</div>';
            }
        }

        async function loadMessages() {
            try {
                const response = await fetch('/messages/recent?limit=${this.config.maxMessagesPerPage}&page=' + currentPage);
                const data = await response.json();

                renderMessages(data.messages);
                updatePagination(data.pagination);
            } catch (error) {
                console.error('Failed to load messages:', error);
            }
        }

        async function loadConversations() {
            try {
                const response = await fetch('/conversations/active?limit=20');
                const data = await response.json();

                renderConversations(data.conversations);
            } catch (error) {
                console.error('Failed to load conversations:', error);
            }
        }

        async function loadAnalytics() {
            try {
                const response = await fetch('/analytics/stats');
                const data = await response.json();

                updateAnalytics(data);
                renderCharts(data);
            } catch (error) {
                console.error('Failed to load analytics:', error);
            }
        }

        // Rendering Functions
        function updateChannelSummary(data) {
            document.getElementById('total-channels').textContent = data.totalChannels || 0;
            document.getElementById('active-channels').textContent =
                Object.values(data.channels || {}).filter(c => c.configured).length;
            document.getElementById('total-messages').textContent = data.totalMessages || 0;
        }

        function renderChannelList(channels) {
            const container = document.getElementById('channel-list');
            container.innerHTML = '';

            Object.entries(channels).forEach(([name, channel]) => {
                const card = document.createElement('div');
                card.className = 'channel-card ' + (channel.configured ? '' : 'inactive');

                card.innerHTML = \`
                    <h3>
                        <span class="channel-status \${channel.configured ? '' : 'inactive'}"></span>
                        \${name}
                    </h3>
                    <div class="channel-info">
                        <div><span>Status:</span> <span>\${channel.configured ? 'Active' : 'Inactive'}</span></div>
                        <div><span>Type:</span> <span>\${channel.config?.dmPolicy || 'Unknown'}</span></div>
                        <div><span>Messages:</span> <span>\${channel.messages || 0}</span></div>
                    </div>
                    <div class="channel-actions">
                        <button onclick="testChannel('\${name}')" class="btn btn-primary">Test</button>
                        <button onclick="configureChannel('\${name}')" class="btn btn-secondary">Configure</button>
                    </div>
                \`;

                container.appendChild(card);
            });
        }

        function renderMessages(messages) {
            const container = document.getElementById('messages-list');
            container.innerHTML = '';

            messages.forEach(message => {
                const item = document.createElement('div');
                item.className = 'message-item';

                item.innerHTML = \`
                    <div class="message-avatar">\${(message.author || 'U')[0].toUpperCase()}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">\${message.author || 'Unknown'}</span>
                            <span class="message-time">\${formatTime(message.timestamp)}</span>
                        </div>
                        <div class="message-text">\${message.content || ''}</div>
                        <div class="message-meta">
                            <small>\${message.channel} • \${message.type}</small>
                        </div>
                    </div>
                \`;

                container.appendChild(item);
            });
        }

        function updatePagination(pagination) {
            document.getElementById('page-info').textContent = \`Page \${pagination.current}\`;
            document.getElementById('prev-page').disabled = !pagination.hasPrev;
            document.getElementById('next-page').disabled = !pagination.hasNext;
        }

        function updateAnalytics(data) {
            document.getElementById('total-msg-stat').textContent = data.totalMessages || 0;
            document.getElementById('active-conv-stat').textContent = data.activeConversations || 0;
            document.getElementById('avg-response-stat').textContent = data.avgResponseTime || '-';
            document.getElementById('success-rate-stat').textContent = data.successRate || '-';
        }

        // Utility Functions
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleString();
        }

        function updateLastRefresh() {
            document.getElementById('update-time').textContent = new Date().toLocaleTimeString();
        }

        function refreshAll() {
            loadChannels();
            if (currentSection === 'messages') loadMessages();
            if (currentSection === 'conversations') loadConversations();
            if (currentSection === 'analytics') loadAnalytics();
            updateLastRefresh();
        }

        // Action Functions
        async function testChannel(name) {
            try {
                const response = await fetch(\`/channels/\${name}/test\`, { method: 'POST' });
                const data = await response.json();
                alert(\`Channel \${name}: \${data.message}\`);
                loadChannels();
            } catch (error) {
                alert(\`Failed to test channel \${name}\`);
            }
        }

        function configureChannel(name) {
            // TODO: Show configuration modal
            alert(\`Configuration for \${name} - Coming soon!\`);
        }

        function showChannelTest() {
            showModal('Channel Test', \`
                <form onsubmit="runChannelTest(event)">
                    <div style="margin-bottom: 1rem;">
                        <label>Select Channel:</label>
                        <select name="channel" required>
                            <option value="">Choose channel...</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>Test Message:</label>
                        <input type="text" name="message" value="Hello from Krab Control Panel!" required style="width: 100%; padding: 0.5rem;">
                    </div>
                    <button type="submit" class="btn btn-primary">Send Test Message</button>
                </form>
            \`);
        }

        function showMessageSearch() {
            showModal('Message Search', \`
                <form onsubmit="runMessageSearch(event)">
                    <div style="margin-bottom: 1rem;">
                        <label>Search Query:</label>
                        <input type="text" name="query" placeholder="Enter search terms..." required style="width: 100%; padding: 0.5rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label>Channel:</label>
                        <select name="channel">
                            <option value="">All Channels</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Search</button>
                </form>
                <div id="search-results" style="margin-top: 1rem;"></div>
            \`);
        }

        function showBulkOperations() {
            showModal('Bulk Operations', \`
                <div class="tool-actions">
                    <button onclick="cleanupOldMessages()" class="btn btn-danger">🧹 Clean Old Messages</button>
                    <button onclick="exportMessages()" class="btn btn-primary">📤 Export Messages</button>
                    <button onclick="optimizeDatabase()" class="btn btn-secondary">⚡ Optimize Database</button>
                </div>
            \`);
        }

        function showModal(title, content) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = \`
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>\${title}</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    \${content}
                </div>
            \`;
            document.getElementById('modals').appendChild(modal);
        }

        // Placeholder functions for future implementation
        function filterMessages() { console.log('Filter messages'); }
        function clearFilters() { console.log('Clear filters'); }
        function changePage(delta) { console.log('Change page:', delta); }
        function renderConversations(data) { console.log('Render conversations:', data); }
        function renderCharts(data) { console.log('Render charts:', data); }
        function runChannelTest(event) { event.preventDefault(); console.log('Run channel test'); }
        function runMessageSearch(event) { event.preventDefault(); console.log('Run message search'); }
        function cleanupOldMessages() { console.log('Cleanup old messages'); }
        function exportMessages() { console.log('Export messages'); }
        function optimizeDatabase() { console.log('Optimize database'); }
        function showSettings() { console.log('Show settings'); }
    `;
  }

  // ── API Endpoints for Control Panel ─────────────────────────
  getApiRoutes() {
    return {
      '/messages/recent': async (req: any, res: any) => {
        try {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || this.config.maxMessagesPerPage || 50;
          const offset = (page - 1) * limit;

          // TODO: Implement message retrieval from state manager
          const messages = [];
          const total = 0;

          res.json({
            messages,
            pagination: {
              current: page,
              total: Math.ceil(total / limit),
              hasPrev: page > 1,
              hasNext: page * limit < total
            }
          });
        } catch (error) {
          logger.error("[ControlPanel] Failed to get recent messages:", error);
          res.status(500).json({ error: "Failed to load messages" });
        }
      },

      '/conversations/active': async (req: any, res: any) => {
        try {
          const limit = parseInt(req.query.limit) || 20;

          // TODO: Implement conversation retrieval
          const conversations = [];

          res.json({ conversations });
        } catch (error) {
          logger.error("[ControlPanel] Failed to get active conversations:", error);
          res.status(500).json({ error: "Failed to load conversations" });
        }
      },

      '/analytics/stats': async (req: any, res: any) => {
        try {
          const stats = await (defaultStateManager as any).messageStore.getStats();

          res.json({
            totalMessages: stats.totalMessages,
            activeConversations: stats.totalConversations,
            avgResponseTime: "-", // TODO: Implement
            successRate: "-", // TODO: Implement
            messagesByChannel: stats.messagesByChannel,
            messagesByType: stats.messagesByType
          });
        } catch (error) {
          logger.error("[ControlPanel] Failed to get analytics:", error);
          res.status(500).json({ error: "Failed to load analytics" });
        }
      }
    };
  }
}

// ── Export default instance ────────────────────────────────────
export const controlPanel = new ControlPanel();

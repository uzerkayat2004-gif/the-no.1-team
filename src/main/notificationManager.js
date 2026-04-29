// notificationManager.js — Desktop + in-app toast notifications

const { Notification } = require('electron');
const { EventEmitter } = require('events');

class NotificationManager extends EventEmitter {
  constructor() {
    super();
    this.settings = { desktopEnabled: true, toastEnabled: true, soundEnabled: false };
  }

  updateSettings(settings) { this.settings = { ...this.settings, ...settings }; }

  showDesktop({ title, body, urgency = 'normal' }) {
    if (!this.settings.desktopEnabled || !Notification.isSupported()) return;
    try {
      const notif = new Notification({ title, body, urgency });
      notif.show();
      notif.on('click', () => this.emit('notification-clicked', { title, body }));
    } catch(e) { console.error('Desktop notification error:', e); }
  }

  showToast({ message, type = 'info', duration = 3000 }) {
    if (!this.settings.toastEnabled) return;
    this.emit('toast', { message, type, duration });
  }

  onPipelineComplete(sessionId, taskType, isBackground) {
    if (isBackground) this.showDesktop({ title: 'No. 1 Team — Task Complete', body: `${taskType} session finished.` });
    this.showToast({ message: '✅ Task complete — approval needed', type: 'success' });
  }

  onAgentError(agentName, error) {
    this.showToast({ message: `⚠️ ${agentName}: ${error.slice(0, 60)}`, type: 'error', duration: 5000 });
  }

  onAutoApproved(stepName) {
    this.showToast({ message: `⚡ Auto-approved: ${stepName}`, type: 'info', duration: 2000 });
  }

  onSessionSaved(sessionName) {
    this.showToast({ message: `💾 Saved to Brain: ${sessionName}`, type: 'success', duration: 2500 });
  }
}

module.exports = new NotificationManager();

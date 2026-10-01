// ============================================================================
// DSBC NOTIFICATION & EMAIL FOUNDATION SERVICE (Directive 20)
// ============================================================================

export type NotificationEventType =
  | 'WELCOME'
  | 'EMAIL_VERIFICATION'
  | 'PROFILE_PUBLISHED'
  | 'PAYMENT_SUCCESSFUL'
  | 'PAYMENT_FAILED'
  | 'TRIAL_ENDING'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'COMPANY_INVITATION'
  | 'EMPLOYEE_INVITATION';

export interface NotificationPayload {
  eventId: string;
  eventType: NotificationEventType;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  contentBody: string;
  ctaLink?: string;
  ctaText?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  provider: 'console_mock' | 'resend' | 'sendgrid' | 'postmark';
}

export interface NotificationProvider {
  name: string;
  sendNotification(payload: NotificationPayload): Promise<{ success: boolean; messageId: string }>;
}

export class DefaultNotificationAdapter implements NotificationProvider {
  public name = 'console_mock';

  public async sendNotification(payload: NotificationPayload): Promise<{ success: boolean; messageId: string }> {
    // In dev/client environment, log formatted notification record
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return { success: true, messageId };
  }
}

const STORAGE_KEY = 'dsbc_notification_ledger_v1';

class NotificationService {
  private ledger: NotificationPayload[] = [];
  private provider: NotificationProvider = new DefaultNotificationAdapter();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadStorage();
  }

  private loadStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.ledger = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading notification ledger:', e);
    }
  }

  private saveStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ledger.slice(0, 300)));
    } catch (e) {
      console.error('Error saving notification ledger:', e);
    }
  }

  public setProvider(provider: NotificationProvider): void {
    this.provider = provider;
  }

  public async dispatchNotification(
    eventType: NotificationEventType,
    recipientEmail: string,
    recipientName: string,
    params: {
      ctaLink?: string;
      ctaText?: string;
      metadata?: Record<string, any>;
      customSubject?: string;
      customBody?: string;
    }
  ): Promise<NotificationPayload> {
    const { subject, body } = this.generateContent(eventType, recipientName, params);

    const payload: NotificationPayload = {
      eventId: `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      recipientEmail,
      recipientName,
      subject: params.customSubject || subject,
      contentBody: params.customBody || body,
      ctaLink: params.ctaLink,
      ctaText: params.ctaText,
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
      status: 'QUEUED',
      provider: 'console_mock',
    };

    try {
      const res = await this.provider.sendNotification(payload);
      payload.status = res.success ? 'SENT' : 'FAILED';
    } catch (e) {
      payload.status = 'FAILED';
    }

    this.ledger.unshift(payload);
    this.saveStorage();
    this.notify();
    return payload;
  }

  public getLedger(recipientEmail?: string): NotificationPayload[] {
    if (!recipientEmail) return [...this.ledger];
    return this.ledger.filter((n) => n.recipientEmail.toLowerCase() === recipientEmail.toLowerCase());
  }

  private generateContent(
    type: NotificationEventType,
    name: string,
    params: any
  ): { subject: string; body: string } {
    switch (type) {
      case 'WELCOME':
        return {
          subject: 'Welcome to DSBC SaaS!',
          body: `Hi ${name}, welcome to Digital Business Card SaaS. Your digital identity workspace is ready.`,
        };
      case 'EMAIL_VERIFICATION':
        return {
          subject: 'Verify your email address for DSBC',
          body: `Hi ${name}, please verify your email address to secure your DSBC account.`,
        };
      case 'PROFILE_PUBLISHED':
        return {
          subject: 'Your Digital Business Card is Live!',
          body: `Congratulations ${name}! Your digital card has been published and is now available at ${params.ctaLink || 'your public URL'}.`,
        };
      case 'PAYMENT_SUCCESSFUL':
        return {
          subject: 'Payment Receipt: Subscription Confirmed',
          body: `Thank you ${name}. Your subscription payment was processed successfully. Official tax invoice is attached in your billing center.`,
        };
      case 'PAYMENT_FAILED':
        return {
          subject: 'Urgent: Subscription Payment Failed',
          body: `Hi ${name}, we were unable to process your subscription renewal. A 7-day grace period is active to ensure uninterrupted access.`,
        };
      case 'TRIAL_ENDING':
        return {
          subject: 'Your DSBC Pro Trial is Ending Soon',
          body: `Hi ${name}, your 14-day Pro trial will conclude in 3 days. Upgrade today to keep custom vanity URLs, rich analytics, and unlimited portfolios.`,
        };
      case 'SUBSCRIPTION_RENEWED':
        return {
          subject: 'DSBC Subscription Renewed Successfully',
          body: `Hi ${name}, your annual plan has renewed successfully. Thank you for your continued partnership.`,
        };
      case 'SUBSCRIPTION_CANCELLED':
        return {
          subject: 'Subscription Cancellation Scheduled',
          body: `Hi ${name}, your cancellation request has been scheduled for the end of your billing cycle. Your data will remain preserved under Free tier limits.`,
        };
      case 'SUBSCRIPTION_EXPIRED':
        return {
          subject: 'Subscription Concluded: Account Reverted to Free',
          body: `Hi ${name}, your subscription has concluded. Your content is safely preserved under standard Free tier access limits.`,
        };
      case 'COMPANY_INVITATION':
        return {
          subject: 'Invitation to Join Corporate DSBC Workspace',
          body: `Hi ${name}, you have been invited to join the official corporate team directory on DSBC.`,
        };
      case 'EMPLOYEE_INVITATION':
        return {
          subject: 'Your Official Digital Business Card is Ready',
          body: `Hi ${name}, your company administrator has created your verified digital business card. Click below to claim your card.`,
        };
      default:
        return {
          subject: 'DSBC Platform Notification',
          body: `Hi ${name}, you have a new update regarding your DSBC digital card.`,
        };
    }
  }

  public getNotificationsForTenant(tenantId: string): NotificationPayload[] {
    return this.ledger.filter((n) => n.tenantId === tenantId || n.metadata?.tenantId === tenantId);
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Notification listener error:', e);
      }
    });
  }
}

export const notificationService = new NotificationService();

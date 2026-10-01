// ============================================================================
// DSBC CUSTOMER SUPPORT & INQUIRY SERVICE (Directive 21)
// ============================================================================

export type SupportCategory =
  | 'HELP'
  | 'FAQ'
  | 'CONTACT_SUPPORT'
  | 'REPORT_PROBLEM'
  | 'ENTERPRISE_INQUIRY';

export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  customerId?: string;
  customerType?: 'individual' | 'company' | 'visitor';
  createdAt: string;
  updatedAt: string;
  responseNotes?: string;
}

const STORAGE_KEY = 'dsbc_support_tickets_v1';

class SupportService {
  private tickets: SupportTicket[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadStorage();
    if (this.tickets.length === 0) {
      this.seedBaselineTickets();
    }
  }

  private loadStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.tickets = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading support tickets:', e);
    }
  }

  private saveStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tickets));
    } catch (e) {
      console.error('Error saving support tickets:', e);
    }
  }

  private seedBaselineTickets(): void {
    const baseline: SupportTicket[] = [
      {
        id: 'tkt_001',
        ticketNumber: 'DSBC-1001',
        name: 'Amitabh Sen',
        email: 'amitabh.sen@example.com',
        category: 'HELP',
        subject: 'How to add Apple Wallet NFC pass to iPhone',
        message: 'I want to know if the digital business card can be directly added to Apple Wallet or Google Wallet.',
        status: 'OPEN',
        priority: 'MEDIUM',
        customerType: 'individual',
        createdAt: '2026-03-28T10:15:00.000Z',
        updatedAt: '2026-03-28T10:15:00.000Z',
      },
      {
        id: 'tkt_002',
        ticketNumber: 'DSBC-1002',
        name: 'Sarah Jenkins',
        email: 'sjenkins@nexuscorp.example',
        category: 'ENTERPRISE_INQUIRY',
        subject: 'Custom Domain SSL setup for company portal',
        message: 'We are on Company Pro and would like guidance on configuring our DNS CNAME for cards.nexuscorp.com.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        customerType: 'company',
        createdAt: '2026-03-29T14:30:00.000Z',
        updatedAt: '2026-03-30T09:00:00.000Z',
        responseNotes: 'Assigned to DevOps engineering; verified DNS records propagation.',
      },
      {
        id: 'tkt_003',
        ticketNumber: 'DSBC-1003',
        name: 'Rajesh Kothari',
        email: 'rajesh.k@innovate.example',
        category: 'REPORT_PROBLEM',
        subject: 'Profile photo upload crop aspect ratio on mobile',
        message: 'When uploading square avatar on Android Chrome, avatar preview looked stretched initially before save.',
        status: 'RESOLVED',
        priority: 'LOW',
        customerType: 'individual',
        createdAt: '2026-03-25T11:20:00.000Z',
        updatedAt: '2026-03-26T16:45:00.000Z',
        responseNotes: 'Resolved with CSS object-cover fix across all template presets.',
      },
      {
        id: 'tkt_004',
        ticketNumber: 'DSBC-1004',
        name: 'Elena Rostova',
        email: 'elena@globaltech.example',
        category: 'FAQ',
        subject: 'GST Invoice requirement for annual company subscription',
        message: 'Could we get our GSTIN and registered company tax ID listed on the downloadable invoice PDF?',
        status: 'CLOSED',
        priority: 'LOW',
        customerType: 'company',
        createdAt: '2026-03-20T08:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z',
        responseNotes: 'GSTIN successfully added to billing invoices.',
      },
    ];

    this.tickets = baseline;
    this.saveStorage();
  }

  public createTicket(params: {
    name: string;
    email: string;
    category: SupportCategory;
    subject: string;
    message: string;
    customerType?: 'individual' | 'company' | 'visitor';
  }): SupportTicket {
    const num = Math.floor(1000 + Math.random() * 9000);
    const ticket: SupportTicket = {
      id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketNumber: `DSBC-${num}`,
      name: params.name.trim(),
      email: params.email.trim(),
      category: params.category,
      subject: params.subject.trim(),
      message: params.message.trim(),
      status: 'OPEN',
      priority: params.category === 'REPORT_PROBLEM' ? 'HIGH' : 'MEDIUM',
      customerType: params.customerType || 'visitor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tickets.unshift(ticket);
    this.saveStorage();
    this.notify();
    return ticket;
  }

  public getTickets(statusFilter?: SupportStatus | 'ALL'): SupportTicket[] {
    if (!statusFilter || statusFilter === 'ALL') {
      return [...this.tickets];
    }
    return this.tickets.filter((t) => t.status === statusFilter);
  }

  public updateTicketStatus(
    ticketId: string,
    status: SupportStatus,
    notes?: string
  ): SupportTicket | null {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return null;

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    if (notes !== undefined) {
      ticket.responseNotes = notes;
    }

    this.saveStorage();
    this.notify();
    return ticket;
  }

  public getTicketsForCustomer(customerId: string, customerType?: string): SupportTicket[] {
    return this.tickets.filter((t) => t.customerId === customerId || (!t.customerId && t.email.includes(customerId)));
  }

  public getStatusCounts(): Record<SupportStatus | 'TOTAL', number> {
    return {
      TOTAL: this.tickets.length,
      OPEN: this.tickets.filter((t) => t.status === 'OPEN').length,
      IN_PROGRESS: this.tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      RESOLVED: this.tickets.filter((t) => t.status === 'RESOLVED').length,
      CLOSED: this.tickets.filter((t) => t.status === 'CLOSED').length,
    };
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
        console.error('Support listener error:', e);
      }
    });
  }
}

export const supportService = new SupportService();

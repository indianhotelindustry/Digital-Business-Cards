import { CapturedCardRecord, AIInteractionSummaryRecord, AISuggestionRecord } from '../types/ai';

export interface AIProvider {
  name: string;
  extractBusinessCard(imageSource: string | File): Promise<Partial<CapturedCardRecord['extractedData']>>;
  structureContact(rawText: string): Promise<Partial<CapturedCardRecord['extractedData']>>;
  summarizeInteraction(rawNotes: string): Promise<Omit<AIInteractionSummaryRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>;
  suggestFollowUps(contextData: Record<string, any>): Promise<Array<Omit<AISuggestionRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>>;
}

class MockAIProvider implements AIProvider {
  name = 'mock-ai-assistant';

  async extractBusinessCard(imageSource: string | File): Promise<Partial<CapturedCardRecord['extractedData']>> {
    return {
      fullName: 'Dr. Elena Rostova',
      firstName: 'Elena',
      lastName: 'Rostova',
      designation: 'Chief AI Research Officer',
      company: 'Quantum Dynamics Lab',
      department: 'Advanced Neural Systems',
      phone: '+1 (650) 555-0194',
      mobile: '+1 (650) 555-0199',
      email: 'elena.rostova@quantum-dynamics.example',
      website: 'https://quantum-dynamics.example',
      linkedin: 'https://linkedin.com/in/elena-rostova-quantum',
      address: '400 Silicon Way, Suite 300',
      city: 'Palo Alto',
      state: 'CA',
      country: 'USA',
      postalCode: '94301',
    };
  }

  async structureContact(rawText: string): Promise<Partial<CapturedCardRecord['extractedData']>> {
    return {
      fullName: 'Alex Mercer',
      company: 'Vanguard Capital',
      designation: 'General Partner',
      email: 'alex@vanguardcap.example',
      phone: '+1 (212) 555-0144',
    };
  }

  async summarizeInteraction(rawNotes: string): Promise<Omit<AIInteractionSummaryRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>> {
    return {
      sourceType: 'note',
      rawInput: rawNotes,
      summary: 'Discussed Series B syndicate partnership and Q3 portfolio expansion.',
      keyPoints: ['Strong interest in B2B SaaS deployment', 'Needs security SOC2 attestation doc by Friday'],
      commitments: ['Send security compliance pack to Alex by 5 PM Friday'],
      actionItems: ['Email SOC2 compliance report'],
      suggestedFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      topicsToRevisit: ['Syndicate allocation terms'],
      provenanceStatus: 'AI_SUGGESTED',
    };
  }

  async suggestFollowUps(contextData: Record<string, any>): Promise<Array<Omit<AISuggestionRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>> {
    return [
      {
        targetType: 'follow_up',
        title: 'Send Requested SOC2 Compliance Pack',
        description: 'Promised during Tuesday meeting regarding Series B syndicate review.',
        suggestedPayload: { dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], priority: 'high' },
        status: 'suggested',
        provenanceStatus: 'AI_SUGGESTED',
      },
    ];
  }
}

export const aiProvider: AIProvider = new MockAIProvider();

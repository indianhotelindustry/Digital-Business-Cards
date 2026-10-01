import { aiProvider } from './aiProviderService';
import { CapturedCardRecord, AIInteractionSummaryRecord, AISuggestionRecord, AIDataScopeType } from '../types/ai';

class AIPrivacyGateService {
  /**
   * Enforces strict data scope isolation before submitting information to AI provider.
   */
  async executeAIRequest<T>(
    actorUserId: string,
    dataScope: AIDataScopeType,
    sourceObjectId: string,
    purpose: string,
    operation: () => Promise<T>,
    companyId?: string | null
  ): Promise<T> {
    if (!actorUserId) {
      throw new Error('AI Privacy Gate Error: Unauthenticated AI execution prohibited.');
    }

    // Enforce data scope constraints
    if (dataScope === 'COMPANY_LEAD' && !companyId) {
      throw new Error('AI Privacy Gate Error: Company lead AI request requires valid company tenant context.');
    }

    console.log(`[AI Privacy Gate] Authorized AI Request [Purpose: ${purpose}, Scope: ${dataScope}, Actor: ${actorUserId}]`);

    try {
      const result = await operation();
      return result;
    } catch (err: any) {
      console.error(`[AI Privacy Gate] AI Request Failed [Purpose: ${purpose}]:`, err.message);
      throw err;
    }
  }

  async extractCard(actorUserId: string, imageSource: string | File): Promise<Partial<CapturedCardRecord['extractedData']>> {
    return this.executeAIRequest(actorUserId, 'PERSONAL_CONTACT', 'card_capture_session', 'Business Card OCR Extraction', async () => {
      return await aiProvider.extractBusinessCard(imageSource);
    });
  }

  async summarizeNotes(actorUserId: string, rawNotes: string): Promise<Omit<AIInteractionSummaryRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>> {
    return this.executeAIRequest(actorUserId, 'PERSONAL_NOTE', 'interaction_notes', 'AI Interaction Summary', async () => {
      return await aiProvider.summarizeInteraction(rawNotes);
    });
  }

  async generateFollowUps(actorUserId: string, contextData: Record<string, any>): Promise<Array<Omit<AISuggestionRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>> {
    return this.executeAIRequest(actorUserId, 'PERSONAL_CONNECTION', 'relationship_context', 'Intelligent Follow-Up Suggestions', async () => {
      return await aiProvider.suggestFollowUps(contextData);
    });
  }
}

export const aiPrivacyGate = new AIPrivacyGateService();

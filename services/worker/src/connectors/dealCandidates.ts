export interface DealCandidate {
  crm: 'hubspot' | 'salesforce';
  crm_deal_id: string;
  title: string;
  score: number;
  why: string;
}

export interface DealCandidateProvider {
  getDealCandidates(params: {
    workspaceId: string;
    participantEmails: string[];
    companyDomain?: string;
  }): Promise<DealCandidate[]>;
}

export class DryRunDealCandidateProvider implements DealCandidateProvider {
  async getDealCandidates(): Promise<DealCandidate[]> {
    return [];
  }
}

export class FakeDealCandidateProvider implements DealCandidateProvider {
  constructor(private readonly candidates: DealCandidate[]) {}

  async getDealCandidates(): Promise<DealCandidate[]> {
    return this.candidates;
  }
}

let currentProvider: DealCandidateProvider = new DryRunDealCandidateProvider();

export const setDealCandidateProvider = (provider: DealCandidateProvider) => {
  currentProvider = provider;
};

export const resetDealCandidateProvider = () => {
  currentProvider = new DryRunDealCandidateProvider();
};

export const getDealCandidateProvider = (): DealCandidateProvider => currentProvider;

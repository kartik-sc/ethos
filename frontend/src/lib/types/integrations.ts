// Mirrors backend/app/integrations/schemas.py.
export interface IntegrationToken {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface IntegrationTokenCreated extends IntegrationToken {
  token: string;
}

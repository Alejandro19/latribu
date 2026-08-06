import { createRemoteJWKSet, jwtVerify } from 'jose';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

export type AppleIdentityPayload = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
};

export type AppleVerifier = (identityToken: string, audience: string) => Promise<AppleIdentityPayload | null>;

let verifierOverride: AppleVerifier | null = null;

// Permite a los tests sustituir la verificación real contra Apple (red +
// llaves públicas) por un doble de prueba determinista — mismo patrón que
// google-auth.service.ts.
export function setAppleVerifierForTests(verifier: AppleVerifier | null): void {
  verifierOverride = verifier;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  return jwks;
}

export async function verifyAppleCredential(identityToken: string): Promise<AppleIdentityPayload | null> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return null;
  if (verifierOverride) return verifierOverride(identityToken, clientId);
  try {
    const { payload } = await jwtVerify(identityToken, getJwks(), {
      issuer: APPLE_ISSUER,
      audience: clientId,
    });
    return payload as AppleIdentityPayload;
  } catch {
    return null;
  }
}

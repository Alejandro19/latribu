import { OAuth2Client, type TokenPayload as GoogleTokenPayload } from 'google-auth-library';

export type GoogleVerifier = {
  verifyIdToken(params: { idToken: string; audience: string }): Promise<{ getPayload(): GoogleTokenPayload | undefined }>;
};

let verifierOverride: GoogleVerifier | null = null;

// Permite a los tests sustituir la verificación real contra Google (que
// requiere red y credenciales reales) por un doble de prueba determinista.
export function setGoogleVerifierForTests(verifier: GoogleVerifier | null): void {
  verifierOverride = verifier;
}

function getVerifier(clientId: string): GoogleVerifier {
  if (verifierOverride) return verifierOverride;
  return new OAuth2Client(clientId);
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleTokenPayload | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const verifier = getVerifier(clientId);
  try {
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience: clientId });
    return ticket.getPayload() ?? null;
  } catch {
    return null;
  }
}

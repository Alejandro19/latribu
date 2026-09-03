import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { wompiProvider } from '../../src/services/payment-providers/wompi.provider.js';

// .env.test ya define WOMPI_PUBLIC_KEY/WOMPI_INTEGRITY_SECRET/WOMPI_EVENTS_SECRET
// como dummies — createCharge/verifyWebhook son cálculos locales (sin
// dependencia externa), así que no hace falta mockear ningún cliente.

function buildEventPayload(overrides: { status?: string; reference?: string; eventType?: string } = {}) {
  const reference = overrides.reference ?? 'ref-123';
  const status = overrides.status ?? 'APPROVED';
  const eventType = overrides.eventType ?? 'transaction.updated';
  const timestamp = 1700000000;
  const data = { transaction: { id: 'txn-1', reference, status, amount_in_cents: 9900 } };
  const properties = ['transaction.id', 'transaction.status', 'transaction.reference'];
  const concatenated =
    properties.map((path) => String(path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], data))).join('') +
    String(timestamp) +
    process.env.WOMPI_EVENTS_SECRET;
  const checksum = createHash('sha256').update(concatenated).digest('hex');
  return {
    event: eventType,
    data,
    environment: 'test',
    signature: { properties, checksum },
    timestamp,
    sent_at: new Date().toISOString(),
  };
}

describe('wompiProvider.createCharge', () => {
  it('generates a reference and an integrity signature matching the documented SHA256 formula', async () => {
    const charge = await wompiProvider.createCharge({ amountCents: 9900, currency: 'COP', clientId: 'client-1' });
    if (charge.provider !== 'wompi') throw new Error('expected wompi charge');
    expect(charge.providerReference).toEqual(expect.any(String));
    expect(charge.publicKey).toBe(process.env.WOMPI_PUBLIC_KEY);

    const expected = createHash('sha256')
      .update(`${charge.providerReference}9900COP${process.env.WOMPI_INTEGRITY_SECRET}`)
      .digest('hex');
    expect(charge.integritySignature).toBe(expected);
  });

  it('generates a different reference on every call', async () => {
    const a = await wompiProvider.createCharge({ amountCents: 1000, currency: 'COP', clientId: 'client-1' });
    const b = await wompiProvider.createCharge({ amountCents: 1000, currency: 'COP', clientId: 'client-1' });
    if (a.provider !== 'wompi' || b.provider !== 'wompi') throw new Error('expected wompi charges');
    expect(a.providerReference).not.toBe(b.providerReference);
  });
});

describe('wompiProvider.verifyWebhook', () => {
  it('accepts a payload with a correctly computed checksum', () => {
    const payload = buildEventPayload({ status: 'APPROVED', reference: 'ref-ok' });
    const result = wompiProvider.verifyWebhook(Buffer.from(JSON.stringify(payload)), {});
    expect(result).toEqual({ valid: true, actionable: true, approved: true, providerReference: 'ref-ok' });
  });

  it('rejects a payload whose checksum was tampered with', () => {
    const payload = buildEventPayload();
    payload.signature.checksum = 'not-the-real-checksum';
    const result = wompiProvider.verifyWebhook(Buffer.from(JSON.stringify(payload)), {});
    expect(result).toEqual({ valid: false });
  });

  it('rejects a payload where the amount/status changed after the checksum was computed', () => {
    const payload = buildEventPayload({ status: 'APPROVED' });
    payload.data.transaction.status = 'DECLINED'; // mutado después de firmar
    const result = wompiProvider.verifyWebhook(Buffer.from(JSON.stringify(payload)), {});
    expect(result).toEqual({ valid: false });
  });

  it('marks DECLINED/VOIDED/ERROR as valid but not approved — never activates anything', () => {
    for (const status of ['DECLINED', 'VOIDED', 'ERROR']) {
      const payload = buildEventPayload({ status, reference: `ref-${status}` });
      const result = wompiProvider.verifyWebhook(Buffer.from(JSON.stringify(payload)), {});
      expect(result).toEqual({ valid: true, actionable: true, approved: false, providerReference: `ref-${status}` });
    }
  });

  it('is valid-but-not-actionable for an unrelated event type (e.g. nequi_token.updated)', () => {
    const payload = buildEventPayload({ eventType: 'nequi_token.updated' });
    const result = wompiProvider.verifyWebhook(Buffer.from(JSON.stringify(payload)), {});
    expect(result).toEqual({ valid: true, actionable: false });
  });

  it('rejects malformed JSON', () => {
    const result = wompiProvider.verifyWebhook(Buffer.from('not json'), {});
    expect(result).toEqual({ valid: false });
  });
});

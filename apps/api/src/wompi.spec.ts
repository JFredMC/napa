import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { integritySignature, WompiController } from './wompi';

describe('Wompi signature', () => {
  const prev = process.env['WOMPI_INTEGRITY_SECRET'];
  afterEach(() => {
    if (prev === undefined) delete process.env['WOMPI_INTEGRITY_SECRET'];
    else process.env['WOMPI_INTEGRITY_SECRET'] = prev;
  });

  it('matches the Wompi docs example', () => {
    expect(
      integritySignature('sk8-438k4-xmxm392-sn2m', 2490000, 'COP', 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6'),
    ).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });

  it('signs a valid amount in cents and never returns the secret', () => {
    process.env['WOMPI_INTEGRITY_SECRET'] = 'test_integrity_secret';
    const r = new WompiController().sign({ amount: 25000 });
    expect(r.amountInCents).toBe(2_500_000);
    expect(r.signature).toBe(integritySignature(r.reference, 2_500_000, 'COP', 'test_integrity_secret'));
    expect(JSON.stringify(r)).not.toContain('test_integrity_secret');
  });

  it.each([999, 5_000_001, 1500.5, 'abc', null, undefined])('rejects %p', (amount) => {
    process.env['WOMPI_INTEGRITY_SECRET'] = 'x';
    expect(() => new WompiController().sign({ amount })).toThrow(BadRequestException);
  });

  it('503 without secret', () => {
    delete process.env['WOMPI_INTEGRITY_SECRET'];
    expect(() => new WompiController().sign({ amount: 10000 })).toThrow(ServiceUnavailableException);
  });
});

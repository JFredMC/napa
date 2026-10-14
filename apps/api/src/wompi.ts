import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createHash, randomBytes } from 'node:crypto';

export const WOMPI_MIN_COP = 1_000;
export const WOMPI_MAX_COP = 5_000_000;

export interface WompiSignature {
  reference: string;
  amountInCents: number;
  currency: 'COP';
  signature: string;
}

/** SHA256(reference + amountInCents + currency + integritySecret), según la doc de Wompi. */
export function integritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  secret: string,
): string {
  return createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex');
}

/**
 * Firma de integridad para el Web Checkout de Wompi (aportes del portafolio). El secreto vive
 * solo en el entorno del servidor (WOMPI_INTEGRITY_SECRET) y nunca se devuelve.
 */
@Controller('wompi')
export class WompiController {
  constructor() {}

  @Post('signature')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sign(@Body() body: unknown): WompiSignature {
    const secret = process.env['WOMPI_INTEGRITY_SECRET'];
    if (!secret) throw new ServiceUnavailableException('Wompi no está configurado');
    const raw = (body as { amount?: unknown } | undefined)?.amount;
    const amount = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
    if (
      typeof amount !== 'number' ||
      !Number.isInteger(amount) ||
      amount < WOMPI_MIN_COP ||
      amount > WOMPI_MAX_COP
    ) {
      throw new BadRequestException(
        `amount debe ser un entero entre ${WOMPI_MIN_COP} y ${WOMPI_MAX_COP} COP`,
      );
    }
    const reference =
      `JFD-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`.toUpperCase();
    const amountInCents = amount * 100;
    return {
      reference,
      amountInCents,
      currency: 'COP',
      signature: integritySignature(reference, amountInCents, 'COP', secret),
    };
  }
}

import type { StoreConnector } from '../../connector';
import type { StoreProfile } from '../generator';
import { alkostoProfile, alkostoSimulated } from './alkosto';
import { araProfile, araSimulated } from './ara';
import { carullaProfile, carullaSimulated } from './carulla';
import { d1Profile, d1Simulated } from './d1';
import { exitoProfile, exitoSimulated } from './exito';
import { falabellaProfile, falabellaSimulated } from './falabella';
import { jumboProfile, jumboSimulated } from './jumbo';
import { mercadoLibreProfile, mercadoLibreSimulated } from './mercadolibre';
import { olimpicaProfile, olimpicaSimulated } from './olimpica';
import { sheinProfile, sheinSimulated } from './shein';
import { temuProfile, temuSimulated } from './temu';

/** Perfil simulado de cada tienda. */
export const SIMULATED_PROFILES: Record<string, StoreProfile> = {
  mercadolibre: mercadoLibreProfile,
  exito: exitoProfile,
  carulla: carullaProfile,
  jumbo: jumboProfile,
  olimpica: olimpicaProfile,
  d1: d1Profile,
  ara: araProfile,
  alkosto: alkostoProfile,
  falabella: falabellaProfile,
  shein: sheinProfile,
  temu: temuProfile,
};

/** Un adaptador simulado por tienda. */
export function simulatedConnectors(clock?: () => string): StoreConnector[] {
  return [
    mercadoLibreSimulated(clock),
    exitoSimulated(clock),
    carullaSimulated(clock),
    jumboSimulated(clock),
    olimpicaSimulated(clock),
    d1Simulated(clock),
    araSimulated(clock),
    alkostoSimulated(clock),
    falabellaSimulated(clock),
    sheinSimulated(clock),
    temuSimulated(clock),
  ];
}

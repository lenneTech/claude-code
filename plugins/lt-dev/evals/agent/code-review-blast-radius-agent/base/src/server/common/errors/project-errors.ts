import { IErrorRegistry, mergeErrorCodes } from '@lenne.tech/nest-server';

/**
 * Project-specific error codes
 *
 * Error code ranges:
 * - PROJ_0001-0099: Project errors
 * - PROJ_0100-0199: Business logic errors
 */
export const ProjectErrors = {
  CART_NOT_OPEN: {
    code: 'PROJ_0102',
    message: 'Cart is not open',
    translations: {
      de: 'Der Warenkorb ist bereits abgeschlossen.',
      en: 'The cart has already been checked out.',
    },
  },
  INVALID_AMOUNT: {
    code: 'PROJ_0103',
    message: 'Invalid amount',
    translations: {
      de: 'Der Betrag ist ungültig.',
      en: 'The amount is invalid.',
    },
  },
  OPERATION_NOT_PERMITTED: {
    code: 'PROJ_0100',
    message: 'Operation not permitted',
    translations: {
      de: 'Diese Operation ist nicht erlaubt.',
      en: 'This operation is not permitted.',
    },
  },
} as const satisfies IErrorRegistry;

/**
 * Merged error codes for type-safe usage
 * Combines nest-server LTNS_* errors with project-specific PROJ_* errors
 */
export const ErrorCode = mergeErrorCodes(ProjectErrors);

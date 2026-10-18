import { IErrorRegistry, mergeErrorCodes } from '@lenne.tech/nest-server';

/**
 * Project-specific error codes
 *
 * Error code ranges:
 * - PROJ_0001-0099: Project errors
 * - PROJ_0100-0199: Business logic errors
 */
export const ProjectErrors = {
  CREDIT_ACCOUNT_NOT_FOUND: {
    code: 'PROJ_0001',
    message: 'Credit account not found',
    translations: {
      de: 'Das Guthabenkonto wurde nicht gefunden.',
      en: 'The credit account was not found.',
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
  QUOTA_EXCEEDED: {
    code: 'PROJ_0101',
    message: 'Quota exceeded',
    translations: {
      de: 'Das Kontingent wurde überschritten.',
      en: 'The quota has been exceeded.',
    },
  },
} as const satisfies IErrorRegistry;

/**
 * Merged error codes for type-safe usage
 * Combines nest-server LTNS_* errors with project-specific PROJ_* errors
 */
export const ErrorCode = mergeErrorCodes(ProjectErrors);

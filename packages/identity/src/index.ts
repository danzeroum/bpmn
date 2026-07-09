export { fromBase64, toBase64 } from './base64.js';
export { buildApprovalPayload, encodePayload } from './payload.js';
export { signApproval } from './sign.js';
export { isLegacyApproval, verificationState, verifySignature } from './verify.js';
export { evaluateRoleRequirement } from './rbac.js';
export { deriveAnchorState } from './anchor.js';
export type {
  AnchorAdapter,
  AnchorHead,
  AnchorReceipt,
  AnchorState,
  CanonicalApprovalPayload,
  RoleRequirementResult,
  SignedApproval,
  Signer,
  SignerIdentity,
  VerificationState,
} from './types.js';

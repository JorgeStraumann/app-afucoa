import { requireSupabase } from './supabase.js';

const TOTP_CODE = /^\d{6}$/;

function verifiedTotpFactors(data) {
  return (data?.totp || []).filter((factor) => factor?.status === 'verified');
}

function unverifiedTotpFactors(data) {
  return (data?.all || data?.totp || []).filter(
    (factor) => factor?.factor_type === 'totp' && factor?.status === 'unverified',
  );
}

export async function getMfaStatus() {
  const client = requireSupabase();
  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (assuranceError) throw assuranceError;
  if (factorsError) throw factorsError;

  const currentLevel = assurance?.currentLevel === 'aal2' ? 'aal2' : 'aal1';
  const nextLevel = assurance?.nextLevel === 'aal2' ? 'aal2' : 'aal1';
  const verified = verifiedTotpFactors(factors);

  return {
    currentLevel,
    nextLevel,
    factorId: verified[0]?.id || null,
    mode: currentLevel === 'aal2'
      ? 'ready'
      : nextLevel === 'aal2' && verified.length > 0
        ? 'challenge'
        : 'enrollment',
  };
}

export async function beginTotpEnrollment() {
  const client = requireSupabase();
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError) throw factorsError;

  // An interrupted setup may leave an unverified factor. It carries no usable
  // second factor and is removed before creating a replacement for this user.
  for (const factor of unverifiedTotpFactors(factors)) {
    const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }

  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'AFUCOA administración',
  });
  if (error) throw error;
  if (!data?.id || !data?.totp?.secret || !data?.totp?.uri) {
    throw new Error('mfa_enrollment_unavailable');
  }

  return {
    factorId: data.id,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotp({ factorId, code }) {
  if (!factorId || !TOTP_CODE.test(String(code || ''))) throw new Error('invalid_mfa_code');
  const client = requireSupabase();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { data, error } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: String(code),
  });
  if (error) throw error;
  return data;
}

export async function cancelUnverifiedTotp(factorId) {
  if (!factorId) return;
  const client = requireSupabase();
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError) return;
  if (!unverifiedTotpFactors(factors).some((factor) => factor.id === factorId)) return;
  await client.auth.mfa.unenroll({ factorId }).catch(() => {});
}

export function publicMfaError() {
  return 'No pudimos verificar el código. Revisalo e intentá nuevamente.';
}

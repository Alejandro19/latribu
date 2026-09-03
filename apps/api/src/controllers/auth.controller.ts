import type { Request, Response } from 'express';
import type { LoginInput, ChangePasswordInput, GoogleAuthInput, AppleAuthInput, ForgotPasswordInput, ResetPasswordInput, AcceptInvitationInput } from '@latribu/shared-types';
import * as authService from '../services/auth.service.js';
import * as clientsService from '../services/clients.service.js';
import * as adminsService from '../services/admins.service.js';
import * as therapistsService from '../services/therapists.service.js';
import * as googleAuthService from '../services/google-auth.service.js';
import * as appleAuthService from '../services/apple-auth.service.js';
import * as passwordResetService from '../services/password-reset.service.js';
import * as clientInvitationsService from '../services/client-invitations.service.js';
import { getPersonalInfoByClientId } from '../services/personal-info.service.js';
import { getResolvedModuleAccess } from '../services/type-module-access.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;
  const emailLower = email.toLowerCase().trim();

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    const valid = await authService.verifyPassword(password, admin.passwordHash);
    if (!valid) return err(res, 'Credenciales incorrectas.', 401);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  const client = await clientsService.findClientByEmail(emailLower);
  if (!client) return err(res, 'Credenciales incorrectas.', 401);
  if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
  const valid = await authService.verifyPassword(password, client.passwordHash ?? '');
  if (!valid) return err(res, 'Credenciales incorrectas.', 401);

  const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan, clientType: client.clientType });
  const clientInfo = await getPersonalInfoByClientId(client.id);
  const moduleAccess = await getResolvedModuleAccess(client.clientType, client.permissions);
  return ok(res, {
    token,
    role: 'cliente',
    mustChangePassword: client.mustChangePassword,
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    moduleAccess,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: Boolean(clientInfo?.completedAt),
    language: client.language,
  });
}

export async function therapistLogin(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;
  const emailLower = email.toLowerCase().trim();

  const therapist = await therapistsService.findTherapistByEmail(emailLower);
  if (!therapist) return err(res, 'Credenciales incorrectas.', 401);
  if (!therapist.active) return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
  const valid = await authService.verifyPassword(password, therapist.passwordHash);
  if (!valid) return err(res, 'Credenciales incorrectas.', 401);

  const token = authService.signToken({
    id: therapist.id,
    role: 'terapeuta',
    name: therapist.name,
    email: therapist.email,
    mustChangePassword: therapist.mustChangePassword,
  });
  return ok(res, {
    token,
    role: 'terapeuta',
    mustChangePassword: therapist.mustChangePassword,
    user: { id: therapist.id, name: therapist.name, email: therapist.email, specialty: therapist.specialty },
  });
}

export async function me(req: Request, res: Response) {
  if (req.user?.role === 'admin') {
    const admin = await adminsService.findAdminById(req.user.id);
    if (!admin) return err(res, 'No encontrado.', 404);
    return ok(res, { role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }
  if (req.user?.role === 'terapeuta') {
    const therapist = await therapistsService.findTherapistById(req.user.id);
    if (!therapist) return err(res, 'No encontrado.', 404);
    return ok(res, {
      role: 'terapeuta',
      user: { id: therapist.id, name: therapist.name, email: therapist.email, specialty: therapist.specialty },
    });
  }
  const client = await clientsService.findClientById(req.user!.id);
  if (!client) return err(res, 'No encontrado.', 404);
  const clientInfo = await getPersonalInfoByClientId(client.id);
  const moduleAccess = await getResolvedModuleAccess(client.clientType, client.permissions);
  return ok(res, {
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    moduleAccess,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: Boolean(clientInfo?.completedAt),
    language: client.language,
  });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  if (req.user?.role === 'terapeuta') {
    const therapist = await therapistsService.findTherapistById(req.user.id);
    if (!therapist) return err(res, 'No encontrado.', 404);
    const valid = await authService.verifyPassword(currentPassword, therapist.passwordHash);
    if (!valid) return err(res, 'Contraseña actual incorrecta.', 401);
    const passwordHash = await authService.hashPassword(newPassword);
    await therapistsService.updateTherapistPassword(therapist.id, passwordHash);
    // Se reemite el token sin mustChangePassword — el que tenía el terapeuta
    // en sesión sigue cargando el claim viejo hasta que se le da uno nuevo.
    const token = authService.signToken({ id: therapist.id, role: 'terapeuta', name: therapist.name, email: therapist.email, mustChangePassword: false });
    return ok(res, { message: 'Contraseña actualizada.', token });
  }

  const isAdmin = req.user?.role === 'admin';
  const account = isAdmin
    ? await adminsService.findAdminById(req.user!.id)
    : await clientsService.findClientById(req.user!.id);
  if (!account) return err(res, 'No encontrado.', 404);
  const currentHash = 'passwordHash' in account ? account.passwordHash ?? '' : '';
  const valid = await authService.verifyPassword(currentPassword, currentHash);
  if (!valid) return err(res, 'Contraseña actual incorrecta.', 401);
  const passwordHash = await authService.hashPassword(newPassword);
  if (isAdmin) {
    await adminsService.updateAdminPassword(account.id, passwordHash);
  } else {
    await clientsService.updateClientPassword(account.id, passwordHash);
  }
  return ok(res, { message: 'Contraseña actualizada.' });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as ForgotPasswordInput;
  const emailLower = email.toLowerCase().trim();
  const genericResponse = { message: 'Si el correo existe en nuestro sistema, enviaremos instrucciones para restablecer la contraseña.' };

  const webBaseUrl = process.env.WEB_APP_URL || 'http://localhost:3000';

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    const rawToken = await passwordResetService.createResetToken('admin', admin.id);
    await passwordResetService.sendPasswordResetEmail(admin.email, `${webBaseUrl}/reset-password?token=${rawToken}`);
    return ok(res, genericResponse);
  }

  const client = await clientsService.findClientByEmail(emailLower);
  if (client && client.status !== 'inactive') {
    const rawToken = await passwordResetService.createResetToken('cliente', client.id);
    await passwordResetService.sendPasswordResetEmail(client.email, `${webBaseUrl}/reset-password?token=${rawToken}`);
    return ok(res, genericResponse);
  }

  const therapist = await therapistsService.findTherapistByEmail(emailLower);
  if (therapist && therapist.active) {
    const rawToken = await passwordResetService.createResetToken('terapeuta', therapist.id);
    await passwordResetService.sendPasswordResetEmail(therapist.email, `${webBaseUrl}/reset-password?token=${rawToken}`);
    return ok(res, genericResponse);
  }

  // Ningún email coincidió (o la cuenta está inactiva): misma respuesta,
  // nunca se revela si el correo existe o no.
  return ok(res, genericResponse);
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body as ResetPasswordInput;
  const consumed = await passwordResetService.consumeResetToken(token);
  if (!consumed) return err(res, 'El enlace es inválido o ya expiró. Solicita uno nuevo.', 400);

  const passwordHash = await authService.hashPassword(newPassword);
  if (consumed.userType === 'admin') {
    await adminsService.updateAdminPassword(consumed.userId, passwordHash);
  } else if (consumed.userType === 'cliente') {
    await clientsService.updateClientPassword(consumed.userId, passwordHash);
  } else {
    await therapistsService.updateTherapistPassword(consumed.userId, passwordHash);
  }
  return ok(res, { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
}

// Canjea el token de invitación por una contraseña + sesión activa
// (auto-login) — el cliente nunca ve /login tras crear su contraseña, cae
// directo en /onboarding. Mismo endpoint "canjear secreto por sesión" que
// /reset-password, mismo riesgo de fuerza bruta sobre el token → loginLimiter
// en la ruta (ver auth.routes.ts).
export async function acceptInvitation(req: Request, res: Response) {
  const { token, password } = req.body as AcceptInvitationInput;
  const consumed = await clientInvitationsService.consumeInvitation(token);
  if (!consumed.ok) {
    return err(res, 'Este enlace venció o ya fue usado. Pide al equipo que te reenvíe la invitación.', 400);
  }

  const passwordHash = await authService.hashPassword(password);
  await clientsService.updateClientPassword(consumed.clientId, passwordHash);

  const client = await clientsService.findClientById(consumed.clientId);
  if (!client) return err(res, 'No encontrado.', 404);

  const tokenJwt = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan, clientType: client.clientType });
  const moduleAccess = await getResolvedModuleAccess(client.clientType, client.permissions);
  return ok(res, {
    token: tokenJwt,
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    moduleAccess,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: false,
    language: client.language,
  });
}

export async function googleLogin(req: Request, res: Response) {
  if (!process.env.GOOGLE_CLIENT_ID) return err(res, 'Login con Google no está configurado en el servidor.', 503);
  const { credential } = req.body as GoogleAuthInput;

  const payload = await googleAuthService.verifyGoogleCredential(credential);
  if (!payload || !payload.email_verified || !payload.email) {
    return err(res, 'Token de Google inválido.', 401);
  }

  const emailLower = payload.email.toLowerCase().trim();
  const googleId = payload.sub;

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    if (!admin.googleId) await adminsService.updateAdminGoogleId(admin.id, googleId);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  // Busca primero por email; si no coincide, respalda con el googleId ya
  // vinculado — cubre el caso de un cliente que cambió su correo desde el
  // panel de cuenta después de haber iniciado sesión con Google alguna vez
  // (el email real que entrega Google ya no es el que quedó guardado).
  const client = (await clientsService.findClientByEmail(emailLower)) ?? (await clientsService.findClientByGoogleId(googleId));
  if (client) {
    if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    if (!client.googleId) await clientsService.updateClientGoogleId(client.id, googleId);
    const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan, clientType: client.clientType });
    const moduleAccess = await getResolvedModuleAccess(client.clientType, client.permissions);
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions,
      clientType: client.clientType,
      moduleAccess,
      planExpired: authService.isPlanExpired(client),
      planEndDate: client.planEndDate,
      language: client.language,
    });
  }

  // El alta de cliente es exclusivamente manual desde el panel admin — una
  // identidad de Google sin cuenta previa nunca crea una por su cuenta.
  return err(res, 'No existe una cuenta asociada a este correo. Contacta al administrador para que te dé acceso.', 403);
}

export async function appleLogin(req: Request, res: Response) {
  if (!process.env.APPLE_CLIENT_ID) return err(res, 'Login con Apple no está configurado en el servidor.', 503);
  const { identityToken, name } = req.body as AppleAuthInput;

  const payload = await appleAuthService.verifyAppleCredential(identityToken);
  const emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';
  if (!payload || !emailVerified || !payload.email) {
    return err(res, 'Token de Apple inválido.', 401);
  }

  const emailLower = payload.email.toLowerCase().trim();
  const appleId = payload.sub;

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    if (!admin.appleId) await adminsService.updateAdminAppleId(admin.id, appleId);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  // Mismo respaldo por appleId que googleLogin — ver comentario ahí.
  const client = (await clientsService.findClientByEmail(emailLower)) ?? (await clientsService.findClientByAppleId(appleId));
  if (client) {
    if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    if (!client.appleId) await clientsService.updateClientAppleId(client.id, appleId);
    const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan, clientType: client.clientType });
    const moduleAccess = await getResolvedModuleAccess(client.clientType, client.permissions);
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions,
      clientType: client.clientType,
      moduleAccess,
      planExpired: authService.isPlanExpired(client),
      planEndDate: client.planEndDate,
      language: client.language,
    });
  }

  // Misma regla que Google — ver comentario arriba.
  return err(res, 'No existe una cuenta asociada a este correo. Contacta al administrador para que te dé acceso.', 403);
}

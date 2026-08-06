import type { Request, Response } from 'express';
import type { LoginInput, RegisterInput, ChangePasswordInput, GoogleAuthInput, AppleAuthInput } from '@latribu/shared-types';
import * as authService from '../services/auth.service.js';
import * as clientsService from '../services/clients.service.js';
import * as adminsService from '../services/admins.service.js';
import * as googleAuthService from '../services/google-auth.service.js';
import * as appleAuthService from '../services/apple-auth.service.js';
import { getPersonalInfoByClientId } from '../services/personal-info.service.js';

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
  return ok(res, {
    token,
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: Boolean(clientInfo?.completedAt),
  });
}

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body as RegisterInput;
  const emailLower = email.toLowerCase().trim();
  const [existingAdmin, existingClient] = await Promise.all([
    adminsService.findAdminByEmail(emailLower),
    clientsService.findClientByEmail(emailLower),
  ]);
  if (existingAdmin || existingClient) return err(res, 'Ese email ya está registrado.', 409);

  await clientsService.createInactiveClient({ name, email: emailLower, password });
  return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
}

export async function me(req: Request, res: Response) {
  if (req.user?.role === 'admin') {
    const admin = await adminsService.findAdminById(req.user.id);
    if (!admin) return err(res, 'No encontrado.', 404);
    return ok(res, { role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }
  const client = await clientsService.findClientById(req.user!.id);
  if (!client) return err(res, 'No encontrado.', 404);
  const clientInfo = await getPersonalInfoByClientId(client.id);
  return ok(res, {
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: Boolean(clientInfo?.completedAt),
  });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
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

export async function googleLogin(req: Request, res: Response) {
  if (!process.env.GOOGLE_CLIENT_ID) return err(res, 'Login con Google no está configurado en el servidor.', 503);
  const { credential } = req.body as GoogleAuthInput;

  const payload = await googleAuthService.verifyGoogleCredential(credential);
  if (!payload || !payload.email_verified || !payload.email) {
    return err(res, 'Token de Google inválido.', 401);
  }

  const emailLower = payload.email.toLowerCase().trim();
  const googleId = payload.sub;
  const displayName = payload.name || emailLower;

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    if (!admin.googleId) await adminsService.updateAdminGoogleId(admin.id, googleId);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  const client = await clientsService.findClientByEmail(emailLower);
  if (client) {
    if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    if (!client.googleId) await clientsService.updateClientGoogleId(client.id, googleId);
    const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan, clientType: client.clientType });
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions,
      clientType: client.clientType,
      planExpired: authService.isPlanExpired(client),
      planEndDate: client.planEndDate,
    });
  }

  await clientsService.createInactiveClient({ name: displayName, email: emailLower, googleId });
  return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
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
  const displayName = name || emailLower;

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    if (!admin.appleId) await adminsService.updateAdminAppleId(admin.id, appleId);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  const client = await clientsService.findClientByEmail(emailLower);
  if (client) {
    if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    if (!client.appleId) await clientsService.updateClientAppleId(client.id, appleId);
    const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan, clientType: client.clientType });
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions,
      clientType: client.clientType,
      planExpired: authService.isPlanExpired(client),
      planEndDate: client.planEndDate,
    });
  }

  await clientsService.createInactiveClient({ name: displayName, email: emailLower, appleId });
  return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
}

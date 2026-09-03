// Diccionario de la interfaz fija (nav/chrome, botones, textos del sistema).
// Alcance de esta primera entrega: navegación compartida (topbars) y la
// pantalla de Configuración, incluyendo su propio selector de idioma. El
// contenido administrable (frases, legal) y el resto de los módulos siguen
// en español por ahora — se van sumando bloque a bloque, igual que el
// reskin visual.
//
// Los nombres de módulo (Baseline, Workout, Nutrition...) NUNCA se traducen
// — quedan en inglés siempre, por decisión de marca, sin pasar por este
// diccionario.

const es = {
  'nav.logout': 'Cerrar sesión',
  'nav.membership': 'Membresía',
  'nav.admin': 'Admin',
  'nav.member': 'Miembro',

  'settings.eyebrow': 'Tu cuenta',
  'settings.title': 'Configuración',
  'settings.subtitle': 'Tu perfil, tu membresía y tus datos en Ephirox.',

  'settings.profile.title': 'Mi perfil',
  'settings.profile.changePhoto': 'Cambiar foto',
  'settings.profile.uploading': 'Subiendo…',
  'settings.profile.name': 'Nombre completo',
  'settings.profile.email': 'Correo electrónico',
  'settings.profile.save': 'Guardar cambios',
  'settings.profile.saving': 'Guardando…',

  'settings.language.title': 'Idioma',
  'settings.language.subtitle': 'El idioma se aplica a la navegación, botones y textos del sistema.',
  'settings.language.es': 'Español',
  'settings.language.en': 'Inglés',
  'settings.language.saving': 'Guardando…',

  'settings.membership.title': 'Membresía',
  'settings.membership.manage': 'Gestionar membresía',
  'settings.membership.manageSub': 'Renovar, cambiar de plan o subir a Premium',
  'settings.membership.active': 'Activa',
  'settings.membership.inactive': 'Inactiva',

  'settings.privacy.title': 'Privacidad y datos',
  'settings.privacy.acceptedOn': 'Aceptaste estos documentos el',
  'settings.privacy.loadingConsent': 'Cargando tu consentimiento…',
  'settings.privacy.dataPolicy': 'Política de Tratamiento de Datos',
  'settings.privacy.terms': 'Términos y Condiciones de Uso',
  'settings.privacy.rightsIntro': 'Tus derechos según la Ley 1581 de 2012:',
  'settings.privacy.downloadData': 'Descargar mis datos',
  'settings.privacy.downloadDataGenerating': 'Generando…',
  'settings.privacy.updateConsent': 'Actualizar mi autorización',
  'settings.privacy.requestDeletion': 'Solicitar eliminación de mi cuenta',
  'settings.privacy.deletionWarningTitle': 'Antes de confirmar, esto es lo que pasa:',
  'settings.privacy.deletionPoint1': 'Tu membresía se pausa de inmediato.',
  'settings.privacy.deletionPoint2': 'Tu mentor o terapeuta pierde acceso a tu historial.',
  'settings.privacy.deletionPoint3': 'Tus datos se eliminan dentro de los 15 días hábiles siguientes, conforme a la ley.',
  'settings.privacy.deletionNotice': 'Esto no borra nada al instante — le llega a nuestro equipo, que puede contactarte antes de procesarlo.',
  'settings.privacy.deletionSend': 'Enviar solicitud',
  'settings.privacy.deletionCancel': 'Cancelar',
  'settings.privacy.deletionSent': 'Solicitud enviada. Un asesor te contactará antes de los 15 días hábiles.',
  'settings.privacy.backToSettings': '← Volver a Configuración',

  'settings.devices.title': 'Dispositivos conectados',
  'settings.devices.ouraSyncing': 'Sincronizando sueño y recuperación',
  'settings.devices.ouraDisconnected': 'No conectado',
  'settings.devices.connected': 'Conectado',
  'settings.devices.disconnect': 'Desconectar',
  'settings.devices.connect': 'Conectar',

  'settings.notifications.title': 'Notificaciones',
  'settings.notifications.streak': 'Recordatorios de racha',
  'settings.notifications.streakSub': 'Cuando tu racha está en riesgo',
  'settings.notifications.events': 'Eventos y retiros del Club',
  'settings.notifications.eventsSub': 'Nuevas fechas disponibles',
  'settings.notifications.news': 'Novedades de Ephirox',
  'settings.notifications.newsSub': 'Anuncios generales',

  'settings.security.title': 'Seguridad',
  'settings.security.password': 'Contraseña',
  'settings.security.passwordUpdated': 'Actualizada',
  'settings.security.passwordChangeAnytime': 'Cámbiala cuando quieras',
  'settings.security.change': 'Cambiar',
  'settings.security.close': 'Cerrar',
  'settings.security.currentPassword': 'Contraseña actual',
  'settings.security.newPassword': 'Nueva contraseña',
  'settings.security.confirmChange': 'Confirmar cambio',
  'settings.security.linkedAccounts': 'Cuentas vinculadas',
  'settings.security.none': 'Ninguna',

  'settings.logout': 'Cerrar sesión',
} as const;

const en: Record<keyof typeof es, string> = {
  'nav.logout': 'Log out',
  'nav.membership': 'Membership',
  'nav.admin': 'Admin',
  'nav.member': 'Member',

  'settings.eyebrow': 'Your account',
  'settings.title': 'Settings',
  'settings.subtitle': 'Your profile, membership, and data in Ephirox.',

  'settings.profile.title': 'My profile',
  'settings.profile.changePhoto': 'Change photo',
  'settings.profile.uploading': 'Uploading…',
  'settings.profile.name': 'Full name',
  'settings.profile.email': 'Email address',
  'settings.profile.save': 'Save changes',
  'settings.profile.saving': 'Saving…',

  'settings.language.title': 'Language',
  'settings.language.subtitle': 'Language applies to navigation, buttons, and system text.',
  'settings.language.es': 'Spanish',
  'settings.language.en': 'English',
  'settings.language.saving': 'Saving…',

  'settings.membership.title': 'Membership',
  'settings.membership.manage': 'Manage membership',
  'settings.membership.manageSub': 'Renew, change plan, or upgrade to Premium',
  'settings.membership.active': 'Active',
  'settings.membership.inactive': 'Inactive',

  'settings.privacy.title': 'Privacy and data',
  'settings.privacy.acceptedOn': 'You accepted these documents on',
  'settings.privacy.loadingConsent': 'Loading your consent…',
  'settings.privacy.dataPolicy': 'Data Processing Policy',
  'settings.privacy.terms': 'Terms and Conditions of Use',
  'settings.privacy.rightsIntro': 'Your rights under Colombian Law 1581 of 2012:',
  'settings.privacy.downloadData': 'Download my data',
  'settings.privacy.downloadDataGenerating': 'Generating…',
  'settings.privacy.updateConsent': 'Update my authorization',
  'settings.privacy.requestDeletion': 'Request account deletion',
  'settings.privacy.deletionWarningTitle': 'Before you confirm, here is what happens:',
  'settings.privacy.deletionPoint1': 'Your membership is paused immediately.',
  'settings.privacy.deletionPoint2': 'Your mentor or therapist loses access to your history.',
  'settings.privacy.deletionPoint3': 'Your data is deleted within the following 15 business days, per the law.',
  'settings.privacy.deletionNotice': 'This does not erase anything instantly — it reaches our team, who may contact you before processing it.',
  'settings.privacy.deletionSend': 'Send request',
  'settings.privacy.deletionCancel': 'Cancel',
  'settings.privacy.deletionSent': 'Request sent. An advisor will contact you within 15 business days.',
  'settings.privacy.backToSettings': '← Back to Settings',

  'settings.devices.title': 'Connected devices',
  'settings.devices.ouraSyncing': 'Syncing sleep and recovery',
  'settings.devices.ouraDisconnected': 'Not connected',
  'settings.devices.connected': 'Connected',
  'settings.devices.disconnect': 'Disconnect',
  'settings.devices.connect': 'Connect',

  'settings.notifications.title': 'Notifications',
  'settings.notifications.streak': 'Streak reminders',
  'settings.notifications.streakSub': 'When your streak is at risk',
  'settings.notifications.events': 'Club events and retreats',
  'settings.notifications.eventsSub': 'New dates available',
  'settings.notifications.news': 'Ephirox news',
  'settings.notifications.newsSub': 'General announcements',

  'settings.security.title': 'Security',
  'settings.security.password': 'Password',
  'settings.security.passwordUpdated': 'Updated',
  'settings.security.passwordChangeAnytime': 'Change it anytime',
  'settings.security.change': 'Change',
  'settings.security.close': 'Close',
  'settings.security.currentPassword': 'Current password',
  'settings.security.newPassword': 'New password',
  'settings.security.confirmChange': 'Confirm change',
  'settings.security.linkedAccounts': 'Linked accounts',
  'settings.security.none': 'None',

  'settings.logout': 'Log out',
};

export const DICTIONARIES = { es, en };
export type TranslationKey = keyof typeof es;
export type Language = keyof typeof DICTIONARIES;

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { shell } from './components/shell.js';
import { adminShell, bindAdminShell } from './components/admin-shell.js';
import { renderHome } from './pages/home/home.js';
import { renderLogin, bindLogin } from './pages/login/login.js';
import { renderCarnet, bindCarnet } from './pages/carnet/carnet.js';
import { renderConvenios, bindConvenios, renderAgreementDetail } from './pages/convenios/convenios.js';
import { renderTramites, renderNewRequest, bindNewRequest, renderRequestDetail, bindRequestDetail } from './pages/tramites/tramites.js';
import { renderNoticias } from './pages/noticias/noticias.js';
import { renderDocuments, bindDocuments } from './pages/documentos/documentos.js';
import { renderProposals, bindProposals } from './pages/propuestas/propuestas.js';
import { renderNotifications, bindNotifications } from './pages/notificaciones/notificaciones.js';
import { renderAccount, bindAccount } from './pages/cuenta/cuenta.js';
import { renderVerification } from './pages/verificacion/verificacion.js';
import { renderRecovery, bindRecovery } from './pages/recuperar/recuperar.js';
import { registerRoute, setRouteChangeHandler, startRouter, navigate, renderCurrentRoute } from './router/router.js';
import { bootstrapSession, getSession, isAdminSession, startDemoSession, startRealSession } from './store/session.js';
import { signInWithDocument } from './services/auth-service.js';
import { appMode } from './services/supabase.js';
import { renderAdminDashboard, bindAdminDashboard, renderAdminMembers, bindAdminMembers, renderAdminRequests, bindAdminRequests, renderAdminAgreements, bindAdminAgreements } from './pages/admin/admin.js';
import { renderAdminContent, bindAdminContent, renderAdminDocuments, bindAdminDocuments, renderAdminProposals, bindAdminProposals, renderAdminNotifications, bindAdminNotifications, renderAdminAudit, bindAdminAudit, renderAdminSettings, bindAdminSettings } from './pages/admin/admin-advanced.js';

const app = document.querySelector('#app');

registerRoute('/login', renderLogin, { public: true, bare: true, bind: bindLogin });
registerRoute('/recuperar', renderRecovery, { public: true, bare: true, bind: bindRecovery });
registerRoute('/', renderHome);
registerRoute('/carnet', renderCarnet, { bind: bindCarnet });
registerRoute('/convenios', renderConvenios, { bind: bindConvenios });
registerRoute('/convenios/:id', ({ id }) => renderAgreementDetail(id));
registerRoute('/tramites', renderTramites);
registerRoute('/tramites/nuevo/:id', ({ id }) => renderNewRequest(id), { bind: bindNewRequest });
registerRoute('/solicitudes/:id', ({ id }) => renderRequestDetail(id), { bind: bindRequestDetail });
registerRoute('/noticias', renderNoticias);
registerRoute('/documentos', renderDocuments, { bind: bindDocuments });
registerRoute('/propuestas', renderProposals, { bind: bindProposals });
registerRoute('/notificaciones', renderNotifications, { bind: bindNotifications });
registerRoute('/cuenta', renderAccount, { bind: bindAccount });
registerRoute('/verificar/:token', ({ token }) => renderVerification({ token }), { public: true, bare: true });

registerRoute('/admin', renderAdminDashboard, { layout: 'admin', adminOnly: true, bind: bindAdminDashboard });
registerRoute('/admin/socios', renderAdminMembers, { layout: 'admin', adminOnly: true, bind: bindAdminMembers });
registerRoute('/admin/tramites', renderAdminRequests, { layout: 'admin', adminOnly: true, bind: bindAdminRequests });
registerRoute('/admin/convenios', renderAdminAgreements, { layout: 'admin', adminOnly: true, bind: bindAdminAgreements });
registerRoute('/admin/contenido', renderAdminContent, { layout: 'admin', adminOnly: true, bind: bindAdminContent });
registerRoute('/admin/documentos', renderAdminDocuments, { layout: 'admin', adminOnly: true, bind: bindAdminDocuments });
registerRoute('/admin/propuestas', renderAdminProposals, { layout: 'admin', adminOnly: true, bind: bindAdminProposals });
registerRoute('/admin/notificaciones', renderAdminNotifications, { layout: 'admin', adminOnly: true, bind: bindAdminNotifications });
registerRoute('/admin/auditoria', renderAdminAudit, { layout: 'admin', adminOnly: true, bind: bindAdminAudit });
registerRoute('/admin/configuracion', renderAdminSettings, { layout: 'admin', adminOnly: true, bind: bindAdminSettings });

setRouteChangeHandler(async ({ path, route, params }) => {
  const session = getSession();
  if (!route.public && !session) { navigate('/login'); return; }
  if (route.adminOnly && !isAdminSession()) { navigate('/'); return; }
  if (path === '/login' && session) { navigate('/'); return; }

  const content = await route.renderer(params);
  app.innerHTML = route.bare ? content : route.layout === 'admin' ? adminShell(content, path) : shell(content, path);
  if (route.layout === 'admin') bindAdminShell();

  route.bind?.({
    onSubmit: async ({ documentNumber, password }) => {
      const result = await signInWithDocument(documentNumber, password);
      if (appMode === 'demo') startDemoSession(result.documentNumber);
      else await startRealSession(result);
      navigate('/');
    },
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
});

window.addEventListener('afucoa:session-changed', renderCurrentRoute);

bootstrapSession()
  .then(() => startRouter())
  .catch((error) => {
    console.error('No se pudo inicializar la sesión', error);
    startRouter();
  });

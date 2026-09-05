import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
async function render(role) {
  const source=(await readFile(new URL('src/components/shell.js',root),'utf8'))
    .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  const api=vm.runInNewContext(source+';({shell})',{getSession:()=>({profile:{role,first_name:'DEV',last_name:'Test'}}),initials:()=> 'DT'});
  return api.shell('<h1>Inicio</h1>','/');
}
test('socio no ve Administración',async()=>assert.doesNotMatch(await render('socio'),/>Administración</));
for(const role of ['admin','superadmin'])test(`${role} ve Administración hacia #/admin`,async()=>{
  const html=await render(role);assert.match(html,/href="#\/admin">Administración<\/a>/);
});
test('rutas admin mantienen protección real adminOnly',async()=>{
  const app=await readFile(new URL('src/app.js',root),'utf8');
  const routes=[...app.matchAll(/registerRoute\('\/admin[^']*'[^;]+;/g)].map(x=>x[0]);
  assert.equal(routes.length,10);assert.ok(routes.every(route=>route.includes('adminOnly: true')));
  assert.match(app,/route\.adminOnly && !isAdminSession\(\).*navigate\('\/'\)/);
});
test('logout no invoca baja push y la baja explícita sí permanece',async()=>{
  const account=await readFile(new URL('src/pages/cuenta/cuenta.js',root),'utf8');
  const push=await readFile(new URL('src/components/push-controls.js',root),'utf8');
  assert.doesNotMatch(account,/deactivatePush/);assert.match(push,/disable\.addEventListener[\s\S]*deactivatePush\(\)/);
});

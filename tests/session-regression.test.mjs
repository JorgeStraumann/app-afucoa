import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSession, loadAuth } from './helpers/session-harness.mjs';

const authA = { user: { id: 'auth-dev-a' }, access_token: 'token-a' };
const active = { id: 'profile-dev-a', role: 'socio', status: 'activo' };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function fixture() {
  let sdkSession = null, listener, behavior = async () => ({...active}), pushBehavior=async()=>({state:'unchanged'});
  const stats = { profiles: 0, logouts: 0, notifications: 0, push:0 };
  const session = await loadSession({
    fetchMyProfile: async () => { stats.profiles++; return behavior(); },
    getAuthSession: async () => sdkSession,
    onAuthStateChange: callback => { listener = callback; return () => {}; },
    authSignOut: async () => { stats.logouts++; sdkSession=null; },
    reconcilePushSubscription: async()=>{stats.push++;return pushBehavior();},
    window: { dispatchEvent: () => stats.notifications++ },
    // Only shorten retry delays, not Promise scheduling.
    setTimeout: callback => setTimeout(callback, 0),
  });
  await session.bootstrapSession();
  return { session, stats, setAuth: value => {sdkSession=value;}, setProfile: fn => {behavior=fn;}, setPush:fn=>{pushBehavior=fn;}, emit: (event, snapshot=sdkSession) => listener(event,snapshot) };
}

test('SIGNED_IN y login explícito comparten get_my_profile; eventos repetidos no reconstruyen', async () => {
  const f=await fixture(), pending=deferred(); f.setAuth(authA); f.setProfile(() => pending.promise);
  const event=f.emit('SIGNED_IN'); await tick();
  const login=f.session.startRealSession({session:authA}); await tick();
  assert.equal(f.stats.profiles,1);
  pending.resolve(active); await Promise.all([event,login]);
  await f.emit('SIGNED_IN'); await f.emit('INITIAL_SESSION',null);
  assert.equal(f.stats.profiles,1); assert.equal(f.stats.logouts,0);
  assert.equal(f.session.getSession().user.id,authA.user.id);
});

test('fallo transitorio concurrente reintenta sin cerrar Auth', async () => {
  const f=await fixture(); f.setAuth(authA);
  let count=0; f.setProfile(async () => {if(++count===1) throw new Error('HTTP 503'); return active;});
  await Promise.all([f.session.startRealSession(authA),f.emit('SIGNED_IN')]);
  assert.equal(f.stats.profiles,2); assert.equal(f.stats.logouts,0); assert.ok(f.session.getSession());
});

test('reconciliación push falla cerrada sin hacer logout de Auth',async()=>{
  const f=await fixture();f.setAuth(authA);f.setPush(async()=>{throw new Error('push unavailable');});
  await assert.rejects(f.session.startRealSession(authA),/push unavailable/);
  assert.equal(f.session.getSession(),null);assert.equal(f.stats.logouts,0);assert.equal(f.stats.push,1);
  f.setPush(async()=>({state:'unchanged'}));await f.emit('SIGNED_IN');assert.ok(f.session.getSession());
});

test('fallo persistente conserva tokens; no crea un perfil ficticio y permite reintentar', async () => {
  const f=await fixture(); f.setAuth(authA); f.setProfile(async () => {throw new Error('HTTP 401/timeout');});
  await assert.rejects(f.session.startRealSession(authA),{code:'PROFILE_UNAVAILABLE'});
  assert.equal(f.session.getSession(),null); assert.equal(f.stats.logouts,0);
  f.setProfile(async () => active); await f.emit('SIGNED_IN');
  assert.ok(f.session.getSession());
  f.setProfile(async () => {throw new Error('offline');});
  await assert.rejects(f.session.refreshProfile(),{code:'PROFILE_UNAVAILABLE'});
  assert.equal(f.session.getSession().profile.id,active.id); assert.equal(f.stats.logouts,0);
});

for (const profile of [null,{...active,status:'inactivo'}]) {
  test(`perfil confirmado ${profile?'inactivo':'inexistente'} cierra Auth una sola vez`, async () => {
    const f=await fixture(); f.setAuth(authA); f.setProfile(async () => profile);
    await assert.rejects(f.session.startRealSession(authA),{code:'ACCOUNT_DISABLED'});
    assert.equal(f.stats.logouts,1); assert.equal(f.session.getSession(),null);
  });
}

test('logout manual invalida respuesta pendiente y evento SIGNED_IN antiguo', async () => {
  const f=await fixture(), pending=deferred(); f.setAuth(authA); f.setProfile(() => pending.promise);
  const login=f.session.startRealSession(authA); const rejected=assert.rejects(login,{code:'SESSION_CHANGED'});
  await tick(); await f.session.endSession(); pending.resolve(active); await rejected;
  await f.emit('SIGNED_IN',authA);
  assert.equal(f.session.getSession(),null); assert.equal(f.stats.logouts,1);
});

test('TOKEN_REFRESHED conserva perfil y no remonta formularios; usa el token más reciente', async () => {
  const f=await fixture(), pending=deferred(); f.setAuth(authA); f.setProfile(() => pending.promise);
  const login=f.session.startRealSession(authA); await tick();
  const refreshed={...authA,access_token:'refreshed'}; f.setAuth(refreshed);
  const event=f.emit('TOKEN_REFRESHED'); await tick(); pending.resolve(active); await Promise.all([login,event]);
  assert.equal(f.session.getSession().auth.access_token,'refreshed');
  const notifications=f.stats.notifications; await f.emit('TOKEN_REFRESHED'); await f.emit('SIGNED_IN');
  assert.equal(f.stats.notifications,notifications); assert.equal(f.stats.profiles,1);
});

test('respuesta del usuario anterior nunca se asocia a otra identidad', async () => {
  const f=await fixture(), pending=deferred(); f.setAuth(authA); f.setProfile(() => pending.promise);
  const old=f.session.startRealSession(authA); const rejected=assert.rejects(old,{code:'SESSION_CHANGED'}); await tick();
  const authB={user:{id:'auth-dev-b'},access_token:'token-b'}; f.setAuth(authB);
  f.setProfile(async () => ({...active,id:'profile-dev-b'})); await f.session.startRealSession(authB);
  pending.resolve(active); await rejected;
  assert.equal(f.session.getSession().user.id,'auth-dev-b'); assert.equal(f.session.getSession().profile.id,'profile-dev-b');
});

test('restauración desde SDK e INITIAL_SESSION comparten el perfil', async () => {
  const f=await fixture(); f.setAuth(authA);
  await Promise.all([f.session.bootstrapSession(),f.emit('INITIAL_SESSION')]);
  assert.ok(f.session.getSession()); assert.equal(f.stats.profiles,1); assert.equal(f.stats.logouts,0);
});

test('wrapper transmite el evento fuera del lock y cancela callbacks al desuscribir', async () => {
  let callback, unsubscribed=false; const calls=[];
  const auth=await loadAuth({auth:{onAuthStateChange: fn => {callback=fn; return {data:{subscription:{unsubscribe(){unsubscribed=true;}}}};}}});
  const unsubscribe=auth.onAuthStateChange((...args) => calls.push(args));
  callback('TOKEN_REFRESHED',authA); assert.equal(calls.length,0); await tick();
  assert.equal(calls[0][0],'TOKEN_REFRESHED'); assert.equal(calls[0][1],authA);
  callback('SIGNED_OUT',null); unsubscribe(); await tick();
  assert.equal(calls.length,1); assert.equal(unsubscribed,true);
});

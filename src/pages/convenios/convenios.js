import { listAgreements, getAgreement } from '../../services/agreements-repository.js';
import { listAgreementFavoriteIds, setAgreementFavorite } from '../../services/favorites-repository.js';
import { escapeHtml } from '../../utils/html.js';

let cachedAgreements = [];
let currentAgreement = null;

export async function renderConvenios() {
  const [rows, favoriteIds] = await Promise.all([listAgreements(), listAgreementFavoriteIds()]);
  const favorites = new Set(favoriteIds);
  cachedAgreements = rows.map(row => ({ ...normalize(row), favorite: favorites.has(row.id) }));
  const featured = cachedAgreements.find(x => x.featured) || cachedAgreements[0];
  const categories = ['Todos', ...new Set(cachedAgreements.map(x => x.category).filter(Boolean))];
  return `
    <div class="page-title split"><div><span class="eyebrow">Beneficios para socios</span><h1>Convenios</h1><p>Encontrá beneficios y accedé a la acreditación necesaria desde la misma ficha.</p></div><button class="button secondary" id="agreement-favorites-filter">♡ Mis favoritos</button></div>
    <section class="agreement-toolbar card"><label class="search-wrap big"><span>⌕</span><input id="agreement-search" class="search" placeholder="¿Qué beneficio estás buscando?"></label><div class="chips" id="agreement-categories">${categories.map((x,i)=>`<button class="chip ${i===0?'active':''}" data-category="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div></section>
    ${featured ? `<section class="section"><div class="section-head"><div><span class="eyebrow">Selección AFUCOA</span><h2>Destacado</h2></div></div>${featuredCard(featured)}</section>` : ''}
    <section class="section"><div class="section-head"><h2>Nuevos convenios</h2></div><div class="agreement-strip">${cachedAgreements.filter(x=>x.isNew).map(compactCard).join('') || '<p class="muted">No hay convenios nuevos.</p>'}</div></section>
    <section class="section"><div class="section-head"><h2>Todos los convenios</h2><span class="muted" id="agreement-count">${cachedAgreements.length} beneficios</span></div><div class="agreement-grid" id="agreement-grid">${cachedAgreements.map(agreementCard).join('')}</div><div class="empty-state" id="agreement-empty" hidden><h3>No encontramos convenios</h3><p>Probá con otra búsqueda o categoría.</p></div></section>`;
}

export function bindConvenios() {
  const search = document.querySelector('#agreement-search');
  const categoryRoot = document.querySelector('#agreement-categories');
  let category = 'Todos';
  let favoritesOnly = false;
  const apply = () => {
    const q = (search?.value || '').toLocaleLowerCase('es');
    const filtered = cachedAgreements.filter(x => (!favoritesOnly||x.favorite) && (category==='Todos'||x.category===category) && `${x.name} ${x.category} ${x.benefit} ${x.summary}`.toLocaleLowerCase('es').includes(q));
    document.querySelector('#agreement-grid').innerHTML = filtered.map(agreementCard).join('');
    document.querySelector('#agreement-count').textContent = `${filtered.length} ${filtered.length===1?'beneficio':'beneficios'}`;
    document.querySelector('#agreement-empty').hidden = filtered.length !== 0;
  };
  search?.addEventListener('input', apply);
  categoryRoot?.addEventListener('click', (event) => { const button=event.target.closest('[data-category]'); if(!button)return; category=button.dataset.category; categoryRoot.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===button)); apply(); });
  document.querySelector('#agreement-favorites-filter')?.addEventListener('click', event => { favoritesOnly=!favoritesOnly;event.currentTarget.classList.toggle('primary',favoritesOnly);event.currentTarget.classList.toggle('secondary',!favoritesOnly);event.currentTarget.textContent=favoritesOnly?'♥ Mis favoritos':'♡ Mis favoritos';apply(); });
}

export async function renderAgreementDetail(id) {
  const raw = await getAgreement(id);
  if (!raw) return `<div class="empty-state card"><h1>Convenio no encontrado</h1><a class="button primary" href="#/convenios">Volver a convenios</a></div>`;
  const favorites = new Set(await listAgreementFavoriteIds());
  const item = { ...normalize(raw), favorite: favorites.has(raw.id) };
  currentAgreement = item;
  const action = item.action === 'carnet' ? '<a class="button primary wide" href="#/carnet">Mostrar mi carné</a>' : item.action === 'tramite' ? '<a class="button primary wide" href="#/tramites">Solicitar constancia</a>' : item.action === 'sitio' && item.website ? `<a class="button primary wide" href="${escapeHtml(item.website)}" target="_blank" rel="noopener">Ir al sitio</a>` : '<button class="button primary wide">Ver contacto</button>';
  return `<a class="back-link" href="#/convenios">← Volver a convenios</a><section class="agreement-detail"><article class="agreement-detail-hero"><span class="category-tag">${escapeHtml(item.category)}</span><div><span class="benefit-large">${escapeHtml(item.benefit)}</span><h1>${escapeHtml(item.name)}</h1><p>${escapeHtml(item.summary)}</p></div></article><article class="card agreement-info"><section><span class="eyebrow">Cómo acceder</span><h2>${escapeHtml(item.access)}</h2></section><dl class="detail-list"><div><dt>Condiciones</dt><dd>${escapeHtml(item.conditions)}</dd></div><div><dt>Vigencia</dt><dd>${escapeHtml(item.validity)}</dd></div><div><dt>Quién puede utilizarlo</dt><dd>Socios AFUCOA con afiliación vigente, salvo condición específica del convenio.</dd></div></dl></article><aside class="card agreement-action"><span class="eyebrow">Acceso al beneficio</span><h2>${escapeHtml(item.benefit)}</h2><p>La aplicación te lleva directamente a la acreditación necesaria.</p>${action}<button class="button tertiary wide" data-agreement-favorite>${item.favorite?'♥ Quitar de favoritos':'♡ Guardar favorito'}</button></aside></section>`;
}

export function bindAgreementDetail() {
  document.querySelector('[data-agreement-favorite]')?.addEventListener('click', async event => {
    if (!currentAgreement) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      currentAgreement.favorite = await setAgreementFavorite(currentAgreement.databaseId, !currentAgreement.favorite);
      button.textContent = currentAgreement.favorite ? '♥ Quitar de favoritos' : '♡ Guardar favorito';
    } catch (error) {
      console.error(error);
      button.textContent = 'No se pudo guardar';
    } finally { button.disabled = false; }
  });
}

function normalize(x){return {id:x.slug||x.id,databaseId:x.id,name:x.name||'',category:x.category||'Otros',benefit:x.short_benefit||x.benefit||'',summary:x.description||x.summary||'',conditions:x.conditions||'Consultar condiciones.',access:x.access_instructions||x.access||'Acreditar afiliación AFUCOA.',validity:x.ends_at?`Vigente hasta ${new Date(`${x.ends_at}T12:00:00`).toLocaleDateString('es-UY')}`:(x.validity||'Vigente'),action:x.access_action||x.action||'carnet',featured:Boolean(x.is_featured??x.featured),isNew:Boolean(x.is_new??x.isNew),website:x.website_url||'',locations:x.agreement_locations||[]}}
function featuredCard(x){return `<a class="featured-agreement" href="#/convenios/${encodeURIComponent(x.id)}"><div class="featured-copy"><span class="category-tag">${escapeHtml(x.category)}</span><strong>${escapeHtml(x.benefit)}</strong><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.summary)}</p><span class="button light">Ver beneficio →</span></div><div class="featured-art" aria-hidden="true"><span>%</span></div></a>`}
function compactCard(x){return `<a class="compact-agreement card" href="#/convenios/${encodeURIComponent(x.id)}"><span class="category-tag">${escapeHtml(x.category)}</span><strong>${escapeHtml(x.benefit)}</strong><h3>${escapeHtml(x.name)}</h3></a>`}
function agreementCard(x){return `<a class="agreement-card card" href="#/convenios/${encodeURIComponent(x.id)}"><div class="agreement-card-head"><span class="category-tag">${escapeHtml(x.category)}</span><span class="favorite" aria-label="${x.favorite?'Favorito':'No favorito'}">${x.favorite?'♥':'♡'}</span></div><strong class="benefit">${escapeHtml(x.benefit)}</strong><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.summary)}</p><div class="agreement-card-foot"><span>${escapeHtml(x.validity)}</span><b>Ver beneficio →</b></div></a>`}

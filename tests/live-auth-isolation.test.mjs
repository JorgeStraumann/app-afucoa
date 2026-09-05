import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const testsUrl=new URL('./',import.meta.url);

test('tests LIVE nunca cierran globalmente sesiones DEV compartidas',async()=>{
  const files=(await readdir(testsUrl))
    .filter(name=>name.includes('live') && name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
    .sort();
  assert.ok(files.length>=6,'La auditoría debe cubrir todos los archivos *-live.mjs conocidos.');

  for(const file of files) {
    const source=await readFile(new URL(file,testsUrl),'utf8');
    assert.doesNotMatch(source,/authSignOut\s*:\s*auth\.signOut\b/,`${file} no debe inyectar signOut productivo sin aislarlo.`);
    for(const call of source.matchAll(/\.signOut\s*\(([^)]*)\)/gs)) {
      assert.match(call[1],/\bscope\s*:\s*['"]local['"]/,`${file} contiene signOut sin { scope: 'local' }.`);
    }
  }
});

import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Targeted build/support-link smoke check; never contacts NovelAI or a payment page.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.CHAESSI_PLAYWRIGHT || 'playwright');
const packaged = process.env.CHAESSI_PACKAGED === '1';
const output = path.join(root, '.cache', `distribution-${packaged ? 'packaged' : 'source'}-${Date.now()}`);
await mkdir(output, { recursive: true });
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const checks = [];
const errors = [];
const application = await _electron.launch({
  executablePath: process.env.CHAESSI_ELECTRON || require('electron'),
  args: packaged ? [`--user-data-dir=${output}`] : [path.join(root, 'tests/electron-fixture.cjs')],
  cwd: root,
  env: { ...process.env, PORT: '4196', NAI_ACCESS_TOKEN: '', CHAESSI_ELECTRON_TEST_DATA: output },
  timeout: 45_000,
});
try {
  const runtime = await application.evaluate(({ app, shell }) => {
    globalThis.supportBrowserCalls = [];
    shell.openExternal = async url => { globalThis.supportBrowserCalls.push(url); };
    return { packaged: app.isPackaged, userData: app.getPath('userData'), version: app.getVersion() };
  });
  assert.equal(runtime.packaged, packaged);
  assert.equal(path.resolve(runtime.userData).toLowerCase(), path.resolve(output).toLowerCase());
  if (packaged) assert.equal(runtime.version, version);
  checks.push('Electron version and isolated user data');
  const page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(expected => document.querySelector('#healthStatus')?.textContent === `v${expected}`, version);
  for (const [locale, phrase, button] of [['ko', '일회성 후원', '☕ 개발자에게 커피 한 잔'], ['en', 'one-time donation', '☕ Buy Me a Coffee'], ['ja', '一度だけ', '☕ コーヒーで開発を応援']]) {
    await page.locator('#uiLanguage').selectOption(locale);
    await page.locator('#healthStatus').click();
    await page.waitForFunction(text => document.querySelector('.support-card')?.textContent.includes(text), phrase);
    assert.equal(await page.locator('#aboutVersion').textContent(), `Chaessi Preset ${version}`);
    assert.match(await page.locator('.support-card').textContent(), /\$3/);
    assert.match(await page.locator('.support-card').textContent(), /DooMokDdongGae/);
    assert.equal(await page.locator('#supportCoffeeLink').textContent(), button);
    assert.equal(await page.locator('#supportCoffeeLink').getAttribute('href'), 'https://buymeacoffee.com/magiconcert');
    await page.screenshot({ path: path.join(output, `app-info-${locale}.png`) });
    await page.locator('#supportCoffeeLink').click();
    await page.waitForTimeout(150);
    assert.equal(await application.evaluate(() => globalThis.supportBrowserCalls.length), checks.filter(value => value.startsWith('Support UI')).length + 1);
    assert.equal(application.windows().length, 1, 'donation must not open an Electron payment window');
    checks.push(`Support UI ${locale}: amount, one-time wording, fixed external link`);
    await page.locator('#openIntegratedManual').click();
    await page.locator('#manualReader[open]').waitFor();
    assert.equal(await page.locator('#manualLanguage').inputValue(), locale);
    await page.waitForFunction(() => {
      const picture = document.querySelector('#manualArticle img');
      return picture?.complete && picture.naturalWidth > 0;
    });
    await page.locator('#manualClose').click();
    await page.locator('#aboutCloseButton').click();
  }
  checks.push('Help Center remains accessible with local images in three languages');
  // Exercise the native new-window gate with unrelated and lookalike destinations.
  for (const url of ['https://example.com', 'https://buymeacoffee.com/magiconcert?redirect=other', 'https://buymeacoffee.com.evil.example/magiconcert', 'file:///C:/Windows/win.ini']) {
    await page.evaluate(target => {
      const link = document.createElement('a'); link.id = 'unsafeLinkProbe'; link.href = target; link.target = '_blank'; link.textContent = 'Probe'; document.body.append(link);
    }, url);
    await page.locator('#unsafeLinkProbe').click();
    await page.waitForTimeout(150);
    await page.locator('#unsafeLinkProbe').evaluate(link => link.remove());
  }
  const calls = await application.evaluate(() => globalThis.supportBrowserCalls);
  assert.deepEqual(calls, Array(3).fill('https://buymeacoffee.com/magiconcert'));
  assert.equal(application.windows().length, 1);
  assert.deepEqual(errors, []);
  checks.push('Unrelated/lookalike/file destinations denied; no renderer errors');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ version, packaged, runtime, checks, errors }, null, 2));
  console.log(JSON.stringify({ output, version, packaged, checks }, null, 2));
} finally {
  await application.close();
}

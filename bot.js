import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

puppeteer.use(StealthPlugin());

const URL = 'https://turkpornovideolari.com';
const MAX_BROWSERS = 60;
const OPEN_INTERVAL_MS = 1000;
const BROWSER_LIFETIME_MS = 30000;

const proxyUsername = 'livaproxy8783';
const proxyPassword = 'DMWEKQWEIKDVB';

const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';

const mobileViewport = {
  width: 390,
  height: 844,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
};

async function dragFromCenterToTop(page) {
  const startX = mobileViewport.width / 2;
  const startY = mobileViewport.height / 2;
  const endY = 0;
  const steps = 30;
  const stepSize = (startY - endY) / steps;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX, startY - stepSize * i);

  }

  await page.mouse.up();
}

async function continuousScroll(page, durationMs) {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    await dragFromCenterToTop(page);
  }
}

async function createBrowserInstance() {
  const tempProfilePath = path.join(os.tmpdir(), `puppeteer_profile_${randomUUID()}`);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: tempProfilePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-quic',
      '--enable-ipv6',
    ],
  });

  const page = await browser.newPage();

  await page.authenticate({
    username: proxyUsername,
    password: proxyPassword,
  });

  await page.setUserAgent(mobileUserAgent);
  await page.setViewport(mobileViewport);

  await page.setExtraHTTPHeaders({
    referer: 'https://www.google.com/search?q=porno',
  });

  await page.goto(URL, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  try {
    const ip = await page.evaluate(() =>
      fetch('https://api64.ipify.org?format=json').then(res => res.json()).then(data => data.ip)
    );
    console.log('🌍 IPv6 IP:', ip);
  } catch (e) {
    console.warn('⚠️ IP alınamadı:', e.message);
  }

  return { browser, page, tempProfilePath };
}

async function main() {
  const browsers = [];

  while (true) {
    if (browsers.length >= MAX_BROWSERS) {
      const old = browsers.shift();
      await old.browser.close();
      try {
        await fs.rm(old.tempProfilePath, { recursive: true, force: true });
        console.log('🗑️ Eski profil klasörü silindi:', old.tempProfilePath);
      } catch (err) {
        console.warn('⚠️ Eski profil silinemedi:', err.message);
      }
      console.log('🧹 Eski browser kapatıldı.');
    }

    try {
      const instance = await createBrowserInstance();
      browsers.push(instance);
      console.log(`🚀 Yeni browser açıldı. Aktif: ${browsers.length}`);

      continuousScroll(instance.page, BROWSER_LIFETIME_MS)
        .then(async () => {
          await instance.browser.close();
          try {
            await fs.rm(instance.tempProfilePath, { recursive: true, force: true });
            console.log('🗑️ Profil klasörü silindi:', instance.tempProfilePath);
          } catch (err) {
            console.warn('⚠️ Profil silinemedi:', err.message);
          }
          const index = browsers.indexOf(instance);
          if (index !== -1) browsers.splice(index, 1);
          console.log('✅ Browser süresi doldu, kapatıldı.');
        })
        .catch(async (e) => {
          console.error('❌ Scroll veya kapatma hatası:', e.message);
          await instance.browser.close();
          try {
            await fs.rm(instance.tempProfilePath, { recursive: true, force: true });
            console.log('🗑️ Profil klasörü (catch) silindi:', instance.tempProfilePath);
          } catch (err) {
            console.warn('⚠️ Profil (catch) silinemedi:', err.message);
          }
        });
    } catch (e) {
      console.error('❌ Tarayıcı açılırken hata:', e.message);
    }

    await new Promise((r) => setTimeout(r, OPEN_INTERVAL_MS));
  }
}

main();

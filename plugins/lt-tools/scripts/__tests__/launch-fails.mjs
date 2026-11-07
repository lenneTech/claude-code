// launch-fails.mjs — starts Chrome and makes reading its DevTools port file fail, the way the
// EBUSY on windows-latest did. cdp.test.mjs runs it as a process of its own: once launchChrome
// has rejected, nothing may be left that keeps this process alive. Not a *.test.mjs file, so
// `node --test` never runs it directly.

import { launchChrome } from '../lib/cdp.mjs';

const broken = () => {
  throw Object.assign(new Error('simulated port file failure'), { code: 'EIO' });
};

try {
  const chrome = await launchChrome({ readPortFile: broken });
  console.log('launched');
  await chrome.close();
} catch (err) {
  console.log(`rejected: ${err.message}`);
}

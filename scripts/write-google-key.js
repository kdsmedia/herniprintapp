/**
 * Writes GOOGLE_SERVICE_ACCOUNT_KEY env variable to play-store-key.json
 * Used by EAS Build pre-install hook for auto-submit
 */
const fs = require('fs');
const path = require('path');

const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (key) {
  const dest = path.join(__dirname, '..', 'play-store-key.json');
  fs.writeFileSync(dest, key, 'utf8');
  console.log('✅ play-store-key.json written from environment variable');
} else {
  console.log('⚠️ GOOGLE_SERVICE_ACCOUNT_KEY not set, skipping');
}

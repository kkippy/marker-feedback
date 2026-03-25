import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';

const manifest = {
  manifest_version: 3,
  name: 'Marker Feedback',
  version: '0.1.0',
  description: 'Upload or capture an image and open the marker feedback editor.',
  permissions: ['activeTab', 'tabs'],
  host_permissions: ['<all_urls>'],
  background: { service_worker: 'src/background.ts', type: 'module' },
  action: { default_title: 'Marker Feedback', default_popup: 'src/popup/index.html' }
};

export default defineConfig({
  plugins: [react(), crx({ manifest })]
});

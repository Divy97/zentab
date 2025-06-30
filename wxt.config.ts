import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "zenTab",
    description: "A minimalistic focus extension that blocks distracting websites during focus sessions",
    permissions: ["storage", "tabs"],
    host_permissions: ["<all_urls>"]
  }
});

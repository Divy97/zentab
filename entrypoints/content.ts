export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // console.log('zenTab content script loaded on:', window.location.hostname);
  },
});

import { App } from './d3/App';

// Initialize and start the application
const app = new App();
app.init().catch(console.error);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});

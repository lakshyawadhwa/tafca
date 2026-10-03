import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { initTheme } from './lib/theme.svelte';

// Applied before the first paint so a dark-theme user never sees a white flash.
initTheme();

const app = mount(App, { target: document.getElementById('app')! });

export default app;

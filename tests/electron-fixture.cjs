const { app } = require('electron');
const path = require('node:path');
app.setPath('userData', path.resolve(process.env.CHAESSI_ELECTRON_TEST_DATA));
if (process.env.CHAESSI_TEST_PROVIDER_MODULE) process.env.NODE_OPTIONS = `--import=${process.env.CHAESSI_TEST_PROVIDER_MODULE}`;
import('../electron/main.mjs');

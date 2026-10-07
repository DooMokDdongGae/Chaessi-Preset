const { app } = require('electron');
const path = require('node:path');
app.setPath('userData', path.resolve(process.env.CHAESSI_ELECTRON_TEST_DATA));
import('../electron/main.mjs');

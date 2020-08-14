#!/usr/bin/env -S node --experimental-modules --trace-warnings

import api from './api.mjs';

const options = {

};

const options = (await import(path.join(process.cwd(), 'cataclysm.mjs'))).default();
const data = (await import(path.join(process.cwd(), 'data/index.mjs'))).default();

api(options);

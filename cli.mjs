#!/usr/bin/env -S node --experimental-modules --trace-warnings

import {inspect} from 'util';

import path from 'path';
import yargs from 'yargs';
import kebab from 'lodash/kebabCase.js';
import api from './api.mjs';
import html from './api/index.mjs';

import cleanStack from 'clean-stack';

process.on('unhandledRejection', (reason, promise) => {

    //console.log('Reason: ' + reason);

    console.log(inspect(reason));

    if(reason.stack) console.log("cleanStack: ",cleanStack(reason.stack));
    if(promise.stack) console.log("cleanStack: ",cleanStack(promise.stack));

    process.exit(1);
});

async function main(){

  const defaults = {
    destination: 'docs',
    template: 'main',
  };

  const options = await (await import(path.join(process.cwd(), 'cataclysm.mjs'))).default();

  const template = yargs.argv.template||yargs.argv.t;
  if(template){
    options[template] = template;
  }

  const data = await (await import(path.join(process.cwd(), 'src/data/index.mjs'))).default();

  const setup = Object.assign({
    id: 'cataclysm',
    locations: {},
    options: Object.assign({}, defaults, options),
    data: data,
    content: null,
  });

  setup.locations.root = path.join(process.cwd());
  setup.locations.options = path.join(setup.locations.root, 'cataclysm.mjs');
  setup.locations.dataRoot = path.join(setup.locations.root, 'src', 'data');
  setup.locations.dataModule = path.join(setup.locations.dataRoot, 'index.mjs');

  setup.locations.destination = path.join(setup.locations.root, setup.options.destination);
  setup.locations.templateHelpers = path.join(setup.locations.root, 'src/templates/helpers');
  setup.locations.templateRoot = path.join(setup.locations.root, path.join('src/templates/', setup.options.template));
  setup.locations.templateRootHelpers = path.join(setup.locations.templateRoot, 'helpers');
  setup.locations.templateRootTransformers = path.join(setup.locations.templateRoot, 'transformers');
  setup.locations.templateRootPartials = path.join(setup.locations.templateRoot, 'partials');
  setup.locations.templateRootPages = path.join(setup.locations.templateRoot, 'pages');
  setup.locations.templateRootPosts = path.join(setup.locations.templateRoot, 'posts');
  setup.locations.templateRootPlugins = path.join(setup.locations.templateRoot, 'plugins');
  setup.locations.websiteFiles = path.join(setup.locations.root, 'src/files');
  setup.locations.templateFiles = path.join(setup.locations.templateRoot, 'files');

  const locations = yargs.argv.locations||yargs.argv.l;

  if(locations){
      if(typeof locations === 'boolean'){
        if(locations === true){
          Object.entries(setup.locations)
          .map(([k,v])=>`${kebab(k)} ${v}`)
          .map(str=>console.log(str))
        }
      }else if(typeof locations === 'string'){
        Object.entries(setup.locations)
        .filter(([k,v])=>(kebab(k)==locations))
        .map(([k,v])=>v)
        .map(str=>console.log(str))
      }
  }else{
    if(setup.options.mode == "html"){
      await html(setup);
    } else {
      await api(setup);
    }

  }

}

main();

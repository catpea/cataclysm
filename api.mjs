import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import pretty from 'pretty';
import Handlebars from 'handlebars';
import cloneDeep from 'lodash/cloneDeep.js';

import camelCase from 'lodash/camelCase.js';
import fsWalk from '@nodelib/fs.walk';

import cheerio from 'cheerio'
import posthtml from 'posthtml'
import posthtmlCustomElements from 'posthtml-custom-elements'
import posthtmlNoopener from 'posthtml-noopener';

export default main;

async function main(setup){

  if(fs.pathExistsSync(setup.locations.templateHelpers)){
    for(let item of fs.readdirSync(setup.locations.templateHelpers, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.mjs')).map(file=>({file, name: path.basename(file, '.mjs'), path: path.join(setup.locations.templateHelpers, file) }))){
      const imported = await import(item.path);
      await imported.default({Handlebars});
    }
  }

  if(fs.pathExistsSync(setup.locations.templateRootHelpers)){
    for(let item of fs.readdirSync(setup.locations.templateRootHelpers, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.mjs')).map(file=>({file, name: path.basename(file, '.mjs'), path: path.join(setup.locations.templateRootHelpers, file) }))){
      const imported = await import(item.path);
      await imported.default({Handlebars});
    }
  }

  if(fs.pathExistsSync(setup.locations.templateRootPartials)){
    for(let item of fsWalk.walkSync(setup.locations.templateRootPartials).filter(o=>o.name.endsWith('.hbs')).map(({name:file,path:fullPath})=>({file, name: camelCase(path.join(path.dirname(path.relative(setup.locations.templateRootPartials, fullPath)), path.basename(file, '.hbs'))), path:fullPath }))){
      // console.log(item.path);
      Handlebars.registerPartial(item.name, fs.readFileSync(item.path).toString())
    }
  }

  // Page Creation
  // console.log(`Creating pages`);
  for(let item of fs.readdirSync(setup.locations.templateRootPages, { withFileTypes: true }).filter(o => o.isFile()).map(o=>o.name).filter(name=>name.endsWith('.hbs')).map(file=>({file, name: path.basename(file, '.hbs'), path: path.join(setup.locations.templateRootPages, file) }))){
    const destination = path.join(setup.locations.destination, item.name + '.html')
    const file = item.path;
    // const data = Object.assign({pageId:item.name}, cloneDeep(setup));
    const page = {
      id: item.name,
      file: item.name + '.html',
    };
    const data = Object.assign({page}, cloneDeep(setup));

    let code = template({file, data});

    fs.writeFileSync(destination, code);
    // console.log(`Created ${destination}`);
  }

  if(fs.pathExistsSync(setup.locations.templateRootPlugins)){
  // Plugin Processing
  // console.log(`Executing plugins`);
  for(let plugin of fs.readdirSync(setup.locations.templateRootPlugins, { withFileTypes: true }).filter(o => o.isDirectory()).map(o=>o.name).map(name=>({name, path: path.join(setup.locations.templateRootPlugins, name), module: path.join(setup.locations.templateRootPlugins, name, 'index.mjs') }))){
    const imported = await import(plugin.module);

    const page = {
      id: plugin.name,
    };
    const data = Object.assign({page}, cloneDeep(setup));

    await imported.default({id:plugin.name, plugin, setup:data, template});
  }
  }

  // FINISH UP
  // console.log('Copying Website Files');
  if(fs.pathExistsSync(setup.locations.websiteFiles)) fs.copySync(setup.locations.websiteFiles, setup.locations.destination)
  // console.log('Copying Template Files');
  if(fs.pathExistsSync(setup.locations.templateFiles)) fs.copySync(setup.locations.templateFiles, setup.locations.destination)

  }


function smarter(html){
  const $ = cheerio.load(html);
  // $('img').addClass('img-fluid rounded shadow');
  return $.html();
}

function template({file, data}){
  return [file]
    .map(input=>fs.readFileSync(input).toString())
    .map(input=>Handlebars.compile(input))
    .map(input=>input(data))
    .map(input=>posthtml().use(posthtmlCustomElements(), posthtmlNoopener.noopener()).process(input,{sync:true}).html)
    .map(input=>smarter(input))
    .map(input=>pretty(input,{ocd: true}))
    .pop();
}

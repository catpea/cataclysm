import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import cheerio from 'cheerio';
import humanize from 'humanize';

import camelCase from 'lodash/camelCase.js';
import at from 'lodash/at.js';
import template from 'lodash/template.js';
import flatten from 'lodash/flatten.js';
import fsWalk from '@nodelib/fs.walk';

export default main;

async function main(setup, files){

  await partials(setup, files.filter(item=>item.type == 'partial'));
  await helpers(setup, files.filter(item=>item.type == 'helper'));
  await plugins(setup, files.filter(item=>item.type == 'plugin'));
  await pages(setup, files.filter(item=>item.type == 'page'));


}


async function partials(setup, files){
  for(let item of files){
    item.content = fs.readFileSync(item.location).toString();
  }
}

async function helpers(setup, files){
  for(let item of files){
    const imported = await import(item.location);
    item.function = imported.default;
  }
  console.log(`Helpers (${files.length}): ${files.map(i=>i.name)}`);
}

async function plugins(setup, files){
  for(let item of files){
    const imported = await import(item.location);
    item.function = imported.default;
  }
  //console.log(files);
}

async function pages(setup, files){
  for(let item of files){
    item.content = fs.readFileSync(item.location).toString();
  }
  console.log(`Pages (${files.length}): ${files.map(i=>`${i.name} (${humanize.filesize(i.content.length)})`)}`);
}
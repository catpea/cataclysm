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
  const db = {
    partials: files.filter(item=>item.type == 'partial'),
    helpers: files.filter(item=>item.type == 'helper'),
    plugins: files.filter(item=>item.type == 'plugin'),
    pages: files.filter(item=>item.type == 'page'),
  };

  db.partials.reduce((acc,itm)=>{ if(!acc.partial) acc.partial = {}; acc.partial[itm.name] = itm },db)
  db.helpers.reduce((acc,itm)=>{ if(!acc.helper) acc.helper = {}; acc.helper[itm.name] = itm },db)
  db.plugins.reduce((acc,itm)=>{ if(!acc.plugin) acc.plugin = {}; acc.plugin[itm.name] = itm },db)
  db.pages.reduce((acc,itm)=>{ if(!acc.page) acc.page = {}; acc.page[itm.name] = itm },db)



  await partials(setup, db.partials);
  await helpers(setup, db.helpers);
  await plugins(setup, db.plugins);
  await pages(setup, db.pages);


  for(let page of db.pages){

    const instance = {
      template: {}
    };

    const $ = cheerio.load(page.content);

    // Extract templates marked by template tags, this is a safe initial operation.
    $('template').each(function(i, element) {
      const name = $(element).attr('name');
      if(name){
        const html = $(element).html();
        instance.template[name] = html;
        //console.log(instance.template[name]);
      }
      $(element).remove();
    });

    // Locate all control statements.

    $('*[each]').each(function(i, element) {
      const path = $(element).attr('each');
      $(element).attr('each', null);
      const html = $.html(element) + '\n';
      const dereferenced = flatten(at(setup, path));
      let index = 0;
      for(let item of dereferenced){
        const context = {...item, index}; // TODO: allow alternate naming of index
        const compiled = template(html);
        const interpolated = compiled(context);
        $(element).before(interpolated);
        index++;
      }
      $(element).remove()
    });






    $('*[helper]').each(function(i, element) {
      const id = $(element).attr('helper');
      $(element).attr('helper', null);
      const val = db.helper[id].function(setup);
      $(element).html(val);
    });

    $('helper[name]').each(function(i, element) {
      const id = $(element).attr('name');
      const val = db.helper[id].function(setup);
      $(element).replaceWith(val);
    });





    page.html = $.html();
   console.log(page.html);
  }
  console.log(`HTML (${db.pages.length}): ${db.pages.map(i=>`${i.name} (${humanize.filesize(i.html.length)})`)}`);


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

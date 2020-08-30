import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import cheerio from 'cheerio';
import humanize from 'humanize';

import camelCase from 'lodash/camelCase.js';
import at from 'lodash/at.js';

import template from 'es6-template-strings';

import flatten from 'lodash/flatten.js';
import fsWalk from '@nodelib/fs.walk';

export default main;


function interpolateVariables(text, context){
  let result = text;
  try{
    result = template(text, context);
  }catch(e){
    // console.log(e);
    // console.log('Interpolation failure in each');
   // ignore
  }
  return result;
}

function extractTemplates({setup, db, $, instance}){
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
}

function ifStatements({setup, db, $, instance}){
  // Locate all if statements.
  $('*[if]').each(function(i, element) {
    const path = $(element).attr('if');
    $(element).attr('if', null);
    const dereferenced = at(setup, path).pop(); // seems to always return an empty array so pop is safe
    if(dereferenced){
      // everything is fine
    }else{
      // nope, this node must be destroyed
      $(element).remove()
    }
  });
}

function eachStatements({setup, db, $, instance}){
  // Locate all control statements.
  $('*[each]').each(function(i, element) {
    const path = $(element).attr('each');
    $(element).attr('each', null);
    const html = $.html(element) + '\n';
    const dereferenced = flatten(at(setup, path));
    let index = 0;
    for(let item of dereferenced){
      const context = {...item, index}; // TODO: allow alternate naming of index
      const interpolated = interpolateVariables(html, context);

      const $2 = cheerio.load(interpolated);

        ifStatements({setup, db, $:$2, instance});
        eachStatements({setup, db, $:$2, instance});
        templateInterpolation({setup: Object.assign({}, setup, context), db, $:$2, instance});
        helperExecution({setup, db, $:$2, instance});

      $(element).before($2.html());
      index++;
    }
    $(element).remove()
  });
}

function templateInterpolation({setup, db, $, instance}){
  for(let name in instance.template){
    $(name).each(function(i, element) {

      const html = instance.template[name];
      const interpolated = interpolateVariables(html, setup)

      const $2 = cheerio.load(interpolated);

        ifStatements({setup, db, $:$2, instance});
        eachStatements({setup, db, $:$2, instance});
        templateInterpolation({setup, db, $:$2, instance});
        helperExecution({setup, db, $:$2, instance});

      $(element).replaceWith($2.html());

    });
  }
}

function helperExecution({setup, db, $, instance}){
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
}





async function main(setup, files){

  const db = {};
  // Lists
  db.partials = files.filter(item=>item.type == 'partial');
  db.helpers = files.filter(item=>item.type == 'helper');
  db.plugins = files.filter(item=>item.type == 'plugin');
  db.pages = files.filter(item=>item.type == 'page');
  // Names
  db.partials.reduce((acc,itm)=>{ if(!acc.partial) acc.partial = {}; acc.partial[itm.name] = itm },db)
  db.helpers.reduce((acc,itm)=>{ if(!acc.helper) acc.helper = {}; acc.helper[itm.name] = itm },db)
  db.plugins.reduce((acc,itm)=>{ if(!acc.plugin) acc.plugin = {}; acc.plugin[itm.name] = itm },db)
  db.pages.reduce((acc,itm)=>{ if(!acc.page) acc.page = {}; acc.page[itm.name] = itm },db)

  for(let page of db.pages){

    // processinginstance bound to files.
    const instance = {
      template: {}
    };

    const $ = cheerio.load(page.content);

    extractTemplates({setup, db, $, instance});

    ifStatements({setup, db, $, instance}); // may remove some each statements
    eachStatements({setup, db, $, instance});
    templateInterpolation({setup, db, $, instance});
    helperExecution({setup, db, $, instance});

    page.html = $.html();
    page.html = interpolateVariables(page.html, setup)
    console.log(page.html);
  }
  console.log(`HTML (${db.pages.length}): ${db.pages.map(i=>`${i.name} (${humanize.filesize(i.html.length)})`)}`);


}

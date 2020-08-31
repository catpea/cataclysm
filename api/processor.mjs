import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';
import pretty from 'pretty';
import cheerio from 'cheerio';
import humanize from 'humanize';
import camelCase from 'lodash/camelCase.js';
import at from 'lodash/at.js';
import flatten from 'lodash/flatten.js';
import fsWalk from '@nodelib/fs.walk';

export default main;

async function main(setup, files){

  const db = database(setup, files);

  for(let page of db.pages){

    const $ = cheerio.load(page.content);

    const instance = {template:{}, context:setup, db, $};

    // This should happen once, because templates are stripped off asap, to be used later on.
    templator(instance);

    traverse($('html'), instance);

    page.html = pretty($.html());

    // page.html = interpolate(page.html, setup); // final interpolation pass, at this point all the newly created stuff had things interpolated by their creators.

    console.log(page.html);

  }

  //console.log(`HTML (${db.pages.length}): ${db.pages.map(i=>`${i.name} (${humanize.filesize(i.html.length)})`)}`);


}




function traverse(root, {template, context, page, db, $}){

  console.log(`Address: ${address($, root)}`);

  $(root)
  .contents() // Gets the branches of each branch in the set of matched branchs, including text and comment nodes.
  .filter((index, branch) => branch.nodeType == 1) // select standard nodes only
  .each(function (index, branch) {

    if($(branch).attr('if')){

      const path = $(branch).attr('if');
      const dereferenced = dereference(context, path);

      $(branch).attr('if', null); // remove the spent attribute
      $(branch).attr('if-result', !!dereferenced); // remove the spent attribute

      $(branch).before(`<!-- ${address($, branch)}: if path ${path} returned "${dereferenced}" (keys were ${Object.keys(context).join(", ")}) -->`);
      if(dereferenced === undefined){
        $(branch).remove(); // remove the entire node as it failed the logic test
        // nothing to traverse, the node is gone now
      }else{
        // traverse prior to interpolation

        traverse(branch, {template, context, page, db, $});

        const html = $.html(branch) + '\n'; // get string for interpolation
        const interpolated = interpolate(html, context);
        const $new = cheerio.load(interpolated);
        $(branch).replaceWith($new.html());
      }

    }else if($(branch).attr('each')){
      // const path = $(branch).attr('each');
      // $(branch).attr('each', null);
      // const html = $.html(branch) + '\n';
      // let index = 0;
      // for(let item of dereferenced){
      //   const context = Object.assign({}, context, item, index);
      //   const interpolated = interpolate(html, context);
      //   const $new = cheerio.load(interpolated);
      //   traverse(branch, {template, context, page, db, $:$new});
      //   $(branch).before($new.html());
      //   index++;
      // }
      // $(branch).remove();

    }else if( Object.keys(template).includes(branch.name) ){
      const name = branch.name;

      $(branch).after(`<!-- template ${name} is mounted here here -->`);
      $(branch).remove()

    }else{
      traverse(branch, {template, context, page, db, $});
    }


  })

}



function database(setup, files){

  const db = {};
  // Lists
  db.partials = files.filter(item=>item.type == 'partial');
  db.helpers = files.filter(item=>item.type == 'helper');
  db.plugins = files.filter(item=>item.type == 'plugin');
  db.pages = files.filter(item=>item.type == 'page');

  // Name Lookup
  db.partials.reduce((root,item)=>{ if(!root.partial) root.partial = {}; root.partial[item.name] = item; return root; }, db);
  db.helpers.reduce((root,item)=>{ if(!root.helper) root.helper = {}; root.helper[item.name] = item; return root; }, db);
  db.plugins.reduce((root,item)=>{ if(!root.plugin) root.plugin = {}; root.plugin[item.name] = item; return root; }, db);
  db.pages.reduce((root,item)=>{ if(!root.page) root.page = {}; root.page[item.name] = item; return root; }, db);

  return db;
}

function templator({setup, db, $, template}){
  // Extract templates marked by template tags, this is a safe initial operation.
  $('template').each(function(i, branch) {
    const name = $(branch).attr('name');
    if(name){
      const html = $(branch).html();
      template[name] = html;
    }
    $(branch).remove();
  });
}

function dereference(object={}, path=""){
  let location = object;
  for (let fragment of path.split('.') ) {
    location = location[fragment];
    if(location !== undefined){
      continue; // keep descending down
    }else{
      break; // exit loop and return undefined
    }
  }
  return location;
}

function address($, root){
  const response = $(root)
  .parents()

  .map(function(i, el) {
    return this.name + $(this).attr('class');
  }).get().reverse().concat(root.name).join(' -> ');

  return response;
}


function interpolate(t, c){
  return t.replace(/\${([^}]+)}/g,(m,p)=>p.split('.').reduce((a,f)=>a?a[f]:undefined,c)||m);
}



















// function ifStatements({setup, db, $, instance}){
//   // Locate all if statements.
//   $('*[if]')
//   .filter(o=>!$(this).parent().is("*[each]"))
//   .filter(o=>!$(this).parent().is(Object.keys(instance.template).join(", ")))
//   // TODO: add not for every template type logged in instance, we don't want to execute if statements there
//   .each(function(i, branch) {
//
//     const path = $(branch).attr('if');
//     const dereferenced = !!at(setup, path).pop(); // seems to always return an empty array so pop is safe
//
//     // $(branch).before(`<!-- if evaluated ${path} to ${dereferenced} (keys were ${Object.keys(setup).join(", ")}) -->`)
//
//
//     if( $(branch).attr('debug') ){
//       console.log('>>>>>>>>>>>>>', $(branch).html() );
//       console.log('>>>>>>>>>>>>>', Object.keys(setup).join(", ") );
//     }
//
//     if(dereferenced){
//       // everything is fine, remove the if
//       $(branch).attr('if', null);
//
//       const $2 = $;
//       const setup2 =  setup;
//
//         ifStatements({setup:setup2, db, $:$2, instance});
//         eachStatements({setup:setup2, db, $:$2, instance});
//         templateInterpolation({setup:setup2, db, $:$2, instance});
//         helperExecution({setup:setup2, db, $:$2, instance});
//
//
//
//     }else{
//       // nope, this node must be destroyed
//       $(branch).remove()
//     }
//
//   });
// }

// function eachStatements({setup, db, $, instance}){
//   // Locate all control statements.
//   $('*[each]')
//   .filter(o=>!$(this).parent().is("*[if]")) // those need to run first
//   .filter(o=>!$(this).parent().is(Object.keys(instance.template).join(", "))) // avoid executing statements in templates
//
//   .each(function(i, branch) {
//     const path = $(branch).attr('each');
//
//
//
//     // $(branch).before(`<!-- eval loping ${path} to ${dereferenced} (keys were ${Object.keys(setup).join(", ")}) -->`)
//     for(let item of dereferenced){
//
//       const context = {...item, index}; // TODO: allow alternate naming of index
//       const interpolated = interpolate(html, context);
//       const $2 = cheerio.load(interpolated);
//       const setup2 = Object.assign({}, setup, context);
//
//         // $(branch).before(`<!-- eval evaluating body! keys are ${Object.keys(setup2).join(", ")}) -->`)
//         ifStatements({setup:setup2, db, $:$2, instance});
//         eachStatements({setup:setup2, db, $:$2, instance});
//         templateInterpolation({setup:setup2, db, $:$2, instance});
//         helperExecution({setup:setup2, db, $:$2, instance});
//
//       $(branch).before($2.html());
//       index++;
//     }
//     $(branch).remove()
//   });
// }

// function templateInterpolation({setup, db, $, instance}){
//   for(let name in instance.template){
//     $(name).each(function(i, branch) {
//
//       const html = instance.template[name];
//       const interpolated = interpolate(html, setup)
//
//       const $2 = cheerio.load(interpolated);
//
//         ifStatements({setup, db, $:$2, instance});
//         eachStatements({setup, db, $:$2, instance});
//         templateInterpolation({setup, db, $:$2, instance});
//         helperExecution({setup, db, $:$2, instance});
//
//       $(branch).replaceWith($2.html());
//
//     });
//   }
// }
//
// function helperExecution({setup, db, $, instance}){
//   $('*[helper]').each(function(i, branch) {
//     const id = $(branch).attr('helper');
//     $(branch).attr('helper', null);
//     const val = db.helper[id].function(setup);
//     $(branch).html(val);
//   });
//
//   $('helper[name]').each(function(i, branch) {
//     const id = $(branch).attr('name');
//     const val = db.helper[id].function(setup);
//     $(branch).replaceWith(val);
//   });
// }

import {inspect} from 'util';

import loader from './loader.mjs';
import processor from './processor.mjs';
import inflator from './inflator.mjs';
import copier from './copier.mjs';

export default main;

async function main(setup){

  const files = await loader(setup);
  await inflator(setup, files);
  await processor(setup, files);
  
  // await copier(setup);

}

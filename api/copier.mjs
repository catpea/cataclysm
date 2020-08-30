import {inspect} from 'util';
import fs from 'fs-extra';
import path from 'path';

export default main;

async function main(setup){
  if(fs.pathExistsSync(setup.locations.websiteFiles)){
    fs.copySync(setup.locations.websiteFiles, setup.locations.destination);
  }
  if(fs.pathExistsSync(setup.locations.templateFiles)){
    fs.copySync(setup.locations.templateFiles, setup.locations.destination);
  }
}

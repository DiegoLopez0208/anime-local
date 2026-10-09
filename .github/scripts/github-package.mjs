import {readFile,writeFile} from 'node:fs/promises';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const owner=process.env.GITHUB_REPOSITORY_OWNER?.toLowerCase();
if(!owner||!/^[a-z0-9][a-z0-9-]*$/.test(owner))throw Error('Invalid GitHub package owner.');
if(process.env.RELEASE_TAG&&process.env.RELEASE_TAG!=='v'+pkg.version)throw Error('Release tag does not match package version.');
pkg.name='@'+owner+'/anime-local';
pkg.publishConfig={registry:'https://npm.pkg.github.com',access:'public'};
await writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
console.log('GitHub Packages mirror: '+pkg.name+'@'+pkg.version);

/** Reproducible install of existing Huey contracts; no vendored implementation. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, renameSync, rmSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractPins, loadContracts } from './chat_handoff.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=process.argv[2];
try {
  if (!target || process.argv.length!==3) throw new Error('usage: install_chat_contracts.mjs /existing-parent/huey-contracts');
  const requested=resolve(target),parent=realpathSync(dirname(requested));
  const destination=resolve(parent,requested.split(sep).at(-1)),rel=relative(realpathSync(root),destination);
  if (rel==='' || (!isAbsolute(rel) && rel!=='..' && !rel.startsWith(`..${sep}`))) throw new Error('Install contracts outside the source checkout');
  if (existsSync(destination)) {
    await loadContracts(destination);
    console.log(`Verified existing pinned contracts: ${destination}`);
  } else {
    const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
    for(const sha of [contractPins.reconciliationCommit,contractPins.assemblyCommit]) {
      try {git(['cat-file','-e',`${sha}^{commit}`]);} catch {git(['fetch','--no-tags','https://github.com/grwtsk/huey.git',sha]);}
    }
    const temp=mkdtempSync(resolve(parent,'.huey-contracts-install-'));
    try {
      const paths=['scripts/editorial_pages.mjs','scripts/editorial_inventory.mjs','scripts/editorial_markdown.mjs','scripts/editorial_front_matter.mjs','scripts/literary_model.mjs','planning/literary-model/v1.json','scripts/editorial_reconcile.mjs'];
      for(const path of paths) {
        const commit=path.endsWith('editorial_reconcile.mjs')?contractPins.reconciliationCommit:contractPins.assemblyCommit;
        mkdirSync(dirname(resolve(temp,path)),{recursive:true});
        writeFileSync(resolve(temp,path),git(['show',`${commit}:${path}`]),{flag:'wx'});
      }
      await loadContracts(temp);
      if(existsSync(destination)) throw new Error('Destination appeared during install; inspect before retrying');
      renameSync(temp,destination);
      console.log(`Installed verified #377/#463 contracts: ${destination}`);
    } finally {if(existsSync(temp))rmSync(temp,{recursive:true,force:true});}
  }
} catch(error) {console.error(error.message);process.exitCode=1;}

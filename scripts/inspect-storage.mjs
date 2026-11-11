import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectProjectStorage} from './lib/project-storage.mjs';

export function inspectStorageCli(args) {
  const [project, ...flags] = args;
  if (!project || flags.some(flag => !['--json', '--duplicates'].includes(flag))) throw new Error('Usage: npm run inspect:storage -- <project-dir> [--duplicates] [--json]（只读，不执行清理）');
  const report = inspectProjectStorage(project, {duplicates: flags.includes('--duplicates')});
  if (flags.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    const mib = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
    console.log(`STORAGE ${report.projectPath}: ${mib(report.totalBytes)}, ${report.fileCount} files`);
    for (const [directory, bytes] of Object.entries(report.byDirectory).sort((a, b) => b[1] - a[1])) console.log(`${mib(bytes)} ${directory}`);
    if (report.duplicates) {
      console.log(`IDENTICAL EXTRA BYTES ${mib(report.redundantBytes)} (logical size; physical reclaim may differ)`);
      for (const group of report.duplicates.slice(0, 10)) console.log(`${mib(group.redundantBytes)} ${group.paths.join(' | ')}`);
    }
    console.log(`CLEANUP PREVIEW ONLY: ${report.cleanupPreview.cacheFiles.length} cache files, ${mib(report.cleanupPreview.cacheFiles.reduce((sum, file) => sum + file.bytes, 0))}`);
    console.log(report.cleanupPreview.note);
    for (const warning of report.warnings) console.log(`WARNING ${warning}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {inspectStorageCli(process.argv.slice(2));}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}

import { search, lookup } from '@scriptura/search';
import { listTranslations } from '@scriptura/core';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage:');
    console.log('  scriptura-cli search <translation> <query>');
    console.log('  scriptura-cli lookup <translation> <reference>');
    console.log('  scriptura-cli list');
    console.log();
    console.log('Examples:');
    console.log('  scriptura-cli search kjv "God so loved"');
    console.log('  scriptura-cli lookup kjv "John 3:16"');
    process.exit(0);
  }

  const command = args[0];

  if (command === 'list') {
    const translations = await listTranslations();
    for (const t of translations) {
      console.log(`  ${t.id.padEnd(12)} ${t.name} (${t.language})`);
    }
    return;
  }

  if (command === 'search' && args.length >= 3) {
    const [, translationId, ...queryParts] = args;
    const results = await search(translationId, queryParts.join(' '));
    console.log(`Found ${results.length} result(s):\n`);
    for (const r of results.slice(0, 20)) {
      console.log(`  ${r.ref}`);
      console.log(`  ${r.text}\n`);
    }
    return;
  }

  if (command === 'lookup' && args.length >= 3) {
    const [, translationId, ...refParts] = args;
    const results = await lookup(translationId, refParts.join(' '));
    for (const r of results) {
      console.log(`  ${r.ref}: ${r.text}`);
    }
    return;
  }

  console.error(`Unknown command: ${command}. Run with --help for usage.`);
  process.exit(1);
}

main();

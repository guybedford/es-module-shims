/*
 * Shimport benchmarks for comparison
 */

import fs from 'fs';
import ms from 'pretty-ms';
import c from 'kleur';
import { analyzeModuleSyntax } from '../src/lexer.js';

function parse (source) {
  const result = analyzeModuleSyntax(source);
  if (result[2])
    throw result[2];
  return result;
}

const n = 25;

function test(file) {
	console.log(c.bold.cyan(file));

	const code = fs.readFileSync(file, 'utf-8');

	let err;

	function run(code, file) {
		try {
			const start = process.hrtime();
			parse(code);
			const time = process.hrtime(start);

			const duration = time[0] * 1000 | time[1] / 1e6;

			return { duration };
		} catch (e) {
			err = e;
			return null;
		}
	}

	const firstRun = run(code, file);

	if (firstRun === null) {
		console.log(c.bold.red(err.toString()));
		console.log(err.stack);
		return;
	}

	console.log(`> Cold: ${c.bold.green(ms(firstRun.duration))}`);

	// warm up
	let i = n;
	while (i--) run(code, file);

	// take average
	i = n;
	let total = 0;
	while (i--) total += run(code, file).duration;

	const avg = total / n;
	console.log(`> Warm: ${c.bold.green(ms(avg))} (average of ${n} runs)`);
}

let files = process.argv.slice(2);
if (files.length === 0) {
	files = fs.readdirSync('test/fixtures').map(f => `test/fixtures/${f}`);
}

files.forEach(test);

console.log('');
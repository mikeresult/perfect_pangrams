import * as fs from 'fs';
const start = Date.now();

const letterSets = process.argv.slice(2).map(s => s.toLowerCase().split(''));
if (!letterSets.length) process.exit(0);
const validLetters = letterSets.reduce((a,b) => a.concat(b), []);

let allWords = fs.readFileSync('words.txt').toString().split("\r\n");

// search all words
let words: string[] = [];
wordLoop:
for (const txt of allWords) {
    if (!txt || /[^a-z]/i.test(txt) || /([a-z]).*\1/.test(txt))
        continue;

    if (!txt.split('').every(c => validLetters.indexOf(c) >= 0))
        continue;

    // consecutive letters must be in different sets
    let prev = -1;
    for (const k of txt.split('')) {
        const i = letterSets.findIndex(s => s.indexOf(k) >= 0);
        if (i === prev) continue wordLoop;
        prev = i;
    }

    words.push(txt);
}
console.log(`${Date.now()-start}ms\t${allWords.length} words loaded. ${words.length} left after filtering`);
//console.log(words.join(' '));
allWords = undefined;

let alphabet = "zqxjkvbpygfwmucldrhsnioate".split('')
    .filter(c => validLetters.indexOf(c) >= 0);

// sort the words in groups by starting letter
const groups: {[key: string]: string[]} = {};
for (const txt of words) {
    const key = txt[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(txt);
}
for (const key in groups) {
    groups[key] = groups[key].sort((a,b) => b.length - a.length);
}
console.log(`groups:`, Object.keys(groups).map(g => `${g}: ${groups[g].length}`).join(' '));

alphabet = alphabet.sort((a,b) => groups[b].length - groups[a].length);
console.log(`alphabet:`, alphabet.join(''));

const overlap = (letters: string[], b: string) =>
    letters.some(c => b.indexOf(c) >= 0);

const searchNext = (start: string, letters: string[], chain: string[], depth: number) => {
    if (depth === 0) {
        if (letters.length === 0) {
            console.log(`found: \u001b[32;1m${chain.join(' ')}\u001b[0m`);
            return true;
        }
        return false;
    }

    if (!groups[start]) return false;
    
    // find all words with at least one new letter
    const group = groups[start].filter(txt => overlap(letters, txt));
    if (group.length === 0) return false;

    let found = false;
    for (const txt of group) {
        if (depth === 1 && letters.length > txt.length) break;
        const newLetters = letters.filter(c => txt.indexOf(c) < 0);
        const result = searchNext(txt[txt.length-1], newLetters, [...chain, txt], depth-1);
        if (result) found = true;
    }
    return found;
};

console.log(`starting search... ${Date.now()-start}ms`);
let found = false;
for (let maxDepth = 1; maxDepth <= 5 && !found; maxDepth++) {
    found = false;
    for (const start of alphabet) {
        const result = searchNext(start, validLetters, [], maxDepth);
        if (result) {
            found = true;
        }
    }
}

if (!found) console.log('no solution found');

// log some stats
console.log(`${Date.now()-start}ms`);

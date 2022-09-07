import * as fs from 'fs';
const start = Date.now();

let validWords = fs.readFileSync('words.txt').toString().split("\r\n");

// search all words
let words: string[] = [];
for (const txt of validWords) {
    if (!txt || /[^a-z'.]/i.test(txt) || /([a-z]).*\1/.test(txt))
        continue;

    words.push(txt);
}
console.log(`${Date.now()-start}ms\t${validWords.length} words loaded. ${words.length} left after filtering`);
validWords = undefined;

// optimize the alphabet order to maximize tree pruning
//const alphabet = "zqxjkvbpygfwmucldrhsnioate".split(''); // old list sorted by letter frequency in natural English text
let unsortedAlphabet = "abcdefghijklmnopqrstuvwxyz".split('');
let alphabet = [];
let sortingWords = words;
while (sortingWords.length) {
    const counts = unsortedAlphabet.map(a => sortingWords.filter(s => s.indexOf(a) >= 0).length);
    const leastCommon = Math.min(...counts);
    const nextLetter = unsortedAlphabet[counts.indexOf(leastCommon)];
    unsortedAlphabet = unsortedAlphabet.filter(c => c !== nextLetter);
    alphabet.push(nextLetter);
    sortingWords = sortingWords.filter(s => s.indexOf(nextLetter) < 0);
}
sortingWords = undefined;
alphabet = alphabet.concat(unsortedAlphabet);
console.log(`${Date.now()-start}ms\tShuffled the alphabet`, alphabet.join(''));


const pangramCodes: Array<Array<number>> = [];
let checked = 0;
let branches = 0;

const lsb = (code: number) => code & ~(code -1);
class PNode {
    public letter: number;
    public wordCode = 0;
    public children: PNode[] = [];

    public constructor(letterValue: number) {
        this.letter = letterValue;
        branches++;
    }

    public add(wordCode: number, parts: number) {
        if (parts === 0)
            this.wordCode = wordCode;
        else {
            const nextLetter = lsb(parts);
            let child = this.children.find(c => c.letter === nextLetter);
            if (!child) {
                child = new PNode(nextLetter);
                this.children.push(child);
            }
            child.add(wordCode, parts & ~nextLetter);
        }
    }

    public findPangram(history: Array<PNode>, remaining: number, next: (history: Array<PNode>, letter: number) => void) {
        checked++;
        if (remaining === 0) {
            if (this.wordCode) {
                const match = [ ...history, this ].map(n => n.wordCode);
                pangramCodes.push(match);
                //console.log(new Date().toISOString() + ': ' + JSON.stringify(match));
            }
            return;
        }
        this.children.map(child => {
            const letterValue = child.letter;
            if ((remaining & letterValue) === letterValue)
                child.findPangram(history, remaining & ~letterValue, next);
        });

        if (this.wordCode) {
            history.push(this);
            next(history, remaining);
            history.pop();
        }
    }
}

// build the data structure
const dictionary: PNode = new PNode(0);
const wordCodes: { [code: number]: string[] } = {};
for (const txt of words) {
    // convert the word into a bit flag union of the letters
    const value = txt.split('')
        .map(s => alphabet.indexOf(s))
        .reduce((bits, s) => bits | (1 << s), 0);
    if (!wordCodes[value])
        wordCodes[value] = [ txt ];
    else
        wordCodes[value].push(txt);
}
words = undefined;
for (const w in wordCodes)
    dictionary.add(Number(w), Number(w));
console.log(`${Date.now()-start}ms\tGrew the tree with ${branches} branches`);


// search for pangrams
const topSearch = (history: Array<PNode>, remaining: number) => {
    const nextValue = lsb(remaining);
    const nextNode = dictionary.children.find(c => c.letter === nextValue);
    if (!nextNode) return;
    nextNode.findPangram(history, remaining & ~nextValue, topSearch);
};

topSearch([], (1 << alphabet.length) - 1);


// convert the word codes into actual words
const pangrams = pangramCodes.map(s => s.map(n => wordCodes[n]));


// dump the results to a file
const collapsedList: string[] = [];
const collapse = (str: string, wordSets: string[][]) => {
    if (!wordSets.length) {
        collapsedList.push(str);
        return;
    }
    const thisSet = wordSets.pop();
    thisSet.map(w => collapse(w + " " + str, [...wordSets]));
}
pangrams.map(p => collapse("", p));
const file = fs.createWriteStream("pangrams.txt");
file.on("error", console.error);
collapsedList.forEach(p => file.write(p.trim() + "\r\n"));
file.end();


// log some stats
let total = pangrams.map(p => p.reduce((t,s) => t * s.length, 1))
    .reduce((t,c) => t + c, 0);
console.log(`${Date.now()-start}ms\tFound ${total} pangrams by visiting ${checked} nodes`);

/* Original pixel portraits, rendered as crisp SVG rectangles. */
(function (root) {
  const faces = {
    fox: ['..aa........aa..','..aba......aba..','..abba....abba..','...aaaaaaaaaa...','..aaaaaaaaaaaa..','..aacaaaaaacaa..','..aaccaaaaccaa..','...addaaaadda...','...adddeeddda...','....dddffddd....','.....dddddd.....','......aaaa......'],
    rabbit: ['....aa....aa....','...abba..abba...','...abba..abba...','...abba..abba...','...abba..abba...','....aaaaaaaa....','...aaaaaaaaaa...','...aacaaaacaa...','...aacaaaacaa...','...adddeeddda...','....dddffddd....','.....aaaaaa.....'],
    owl: ['..aa........aa..','..aaaaaaaaaaaa..','...aaaaaaaaaa...','..aaddaaaaddaa..','..addddaddddaa..','..adccdaddccda..','..adccdaddccda..','...ddddeedddd...','...aaaaffa aaa...'.replace(' ',''),'....aaaaaaaa....','.....aaaaaa.....','......aaaa......'],
    cat: ['..aa........aa..','..aba......aba..','..abba....abba..','..aaaaaaaaaaaa..','..aaaaaaaaaaaa..','..aacaaaaaacaa..','..aacaaaaaacaa..','...aaaddeaaa....','..ddaddffddadd..','....adddddda....','.....aaaaaa.....','......aaaa......'],
    wolf: ['..aaa......aaa..','..abaa....aaba..','..abaaa..aaaba..','..aaaaaaaaaaaa..','...aaaaaaaaaa...','..aacaaaaaacaa..','..aacaaaaaacaa..','...aaddddaa a...'.replace(' ',''),'...adddeeddda...','....dddffddd....','.....dddddd.....','......aaaa......'],
    bear: ['...aaa....aaa...','..abbaa..aabba..','..abaaaaaaaa ba..'.replace(' ',''),'...aaaaaaaaaa...','..aaaaaaaaaaaa..','..aacaaaaaacaa..','..aacaaaaaacaa..','..aaadddddaaaa..','...adddeeddda...','...adddffddda...','....aaaaaaaa....','.....aaaaaa.....'],
    raccoon: ['...aa......aa...','..abba....abba..','..abbaaaaaabba..','...aaaaaaaaaa...','..aaaaaaaaaaaa..','..affaaaaaaffa..','..affcaaacaffa..','..affcaaacaffa..','...adddeeddda...','....dddffddd....','.....aaaaaa.....','......aaaa......'],
    frog: ['................','...aaaa..aaaa...','..adddaaadddaa..','..adccaaaccdaa..','..adccaaaccdaa..','..aaaaaaaaaaaa..','.aaaaaaaaaaaaaa.','.aaaaaaaaaaaaaa.','..aaaffffffaaa..','...aaddddddaa...','....aaaaaaaa....','.....aaaaaa.....'],
    gorilla: ['.....aaaaaa.....','....aaaaaaaa....','...aaaaaaaaaa...','..aaaaaaaaaaaa..','..aaddddddddaa..','.aaddddddddddaa.','.aadccddddccdaa.','.aadccddddccdaa.','.aadddeeeedddaa.','..aaddddddddaa..','..aaddffffddaa..','...aaddddddaa...']
  };
  const colors = {
    fox: ['#c87c43','#f1b67a','#f4dfaf'], rabbit: ['#dac7aa','#c9958b','#f1e4d2'], owl: ['#92765a','#b59872','#e6d6b1'],
    cat: ['#c5a46b','#d48c80','#e8d6ad'], wolf: ['#82979c','#b8c7c6','#dce3d9'], bear: ['#987055','#c69878','#ccb48c'],
    raccoon: ['#9a9d92','#beb8a3','#d5d4bc'], frog: ['#86a175','#abc286','#c4d39f'], gorilla: ['#4c5658','#74807e','#a2aba3']
  };
  root.portrait = function (id, extra = '') {
    const [fur, inner, muzzle] = colors[id];
    const palette = { a: fur, b: inner, c: '#182c30', d: muzzle, e: '#354044', f: '#293b3e' };
    const rows = faces[id];
    const rects = rows.flatMap((row, y) => [...row].flatMap((ch, x) => palette[ch] ? [`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`] : [])).join('');
    return `<svg class="portrait ${extra}" viewBox="0 0 16 12" aria-hidden="true" shape-rendering="crispEdges">${rects}</svg>`;
  };
})(globalThis);

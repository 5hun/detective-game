/* Original pixel portraits, rendered as crisp SVG rectangles. */
(function (root) {
  const faces: Record<string, string[]> = {
    dog: ['................','.....aaaaaa.....','...aaaaaaaaaa...','..bbbaaaaaabbb..','.bbbbaaaaaabbbb.','.bbbcaaaaaacbbb.','.bbbcaaaaaacbbb.','.bbbddddddddbbb.','..bbdddeedddbb..','....dddffddd....','.....dddddd.....','......aaaa......'],
    deer: ['.a..a......a..a.','.aaaa......aaaa.','...a........a...','...aaaaaaaaaa...','..abbaaaaaabba..','..aacaaaaaacaa..','..aacaaaaaacaa..','...aaaaaaaaaa...','....addeedda....','....dddffddd....','.....dddddd.....','......aaaa......'],
    elephant: ['.....aaaaaa.....','....aaaaaaaa....','.aaaaaaaaaaaaaa.','abbbbaaaaaabbbba','abbbbaaaaaabbbba','abbbacaaaacabbba','abbbaaaaaaaabbba','.abbaaddddaabba.','..aaaaddddaaaa..','......adda......','......adda.aa...','.......aaaaaa...'],
    rabbit: ['....aa....aa....','...abba..abba...','...abba..abba...','...abba..abba...','...abba..abba...','....aaaaaaaa....','...aaaaaaaaaa...','...aacaaaacaa...','...aacaaaacaa...','...adddeeddda...','....dddffddd....','.....aaaaaa.....'],
    owl: ['..aa........aa..','..aaaaaaaaaaaa..','...aaaaaaaaaa...','..aaddaaaaddaa..','..addddaddddaa..','..adccdaddccda..','..adccdaddccda..','...ddddeedddd...','...aaaaffa aaa...'.replace(' ',''),'....aaaaaaaa....','.....aaaaaa.....','......aaaa......'],
    cat: ['..a..........a..','..aa........aa..','..aba......aba..','..abbaaggaabba..','..aaaaggggaaaa..','..aacaaaaaacaa..','.aaacaaaaaacaaa.','.aaaaaddddaaaaa.','..aaaddddddaaa..','...aaddddddaa...','....aaaaaaaa....','.....aaaaaa.....'],
    wolf: ['..aaa......aaa..','..abaa....aaba..','..abaaa..aaaba..','..aaaaaaaaaaaa..','...aaaaaaaaaa...','..aacaaaaaacaa..','..aacaaaaaacaa..','...aaddddaa a...'.replace(' ',''),'...adddeeddda...','....dddffddd....','.....dddddd.....','......aaaa......'],
    bear: ['...aaa....aaa...','..abbaa..aabba..','..abaaaaaaaa ba..'.replace(' ',''),'...aaaaaaaaaa...','..aaaaaaaaaaaa..','..aacaaaaaacaa..','..aacaaaaaacaa..','..aaadddddaaaa..','...adddeeddda...','...adddffddda...','....aaaaaaaa....','.....aaaaaa.....'],
    pig: ['..aa........aa..','..abaa....aaba..','..abbaaaaaabba..','...aaaaaaaaaa...','..aaaaaaaaaaaa..','..aacaaaaaacaa..','..aacaaaaaacaa..','..aaaddddddaaa..','..aaadeddedaaa..','...aaddddddaa...','....aaaffaaa....','.....aaaaaa.....'],
    frog: ['................','...aaaa..aaaa...','..adddaaadddaa..','..adccaaaccdaa..','..adccaaaccdaa..','..aaaaaaaaaaaa..','.aaaaaaaaaaaaaa.','.aaaaaaaaaaaaaa.','..aaaffffffaaa..','...aaddddddaa...','....aaaaaaaa....','.....aaaaaa.....'],
    gorilla: ['.....aaaaaa.....','....aaaaaaaa....','...aaaaaaaaaa...','..aaaaaaaaaaaa..','..aaddddddddaa..','.aaddddddddddaa.','.aadccddddccdaa.','.aadccddddccdaa.','.aadddeeeedddaa.','..aaddddddddaa..','..aaddffffddaa..','...aaddddddaa...']
  };
  const colors: Record<string, string[]> = {
    dog: ['#e3caa0','#cda878','#f3e5cd'], deer: ['#b88b57','#e0bb89','#f1ddba'],
    elephant: ['#9eafb7','#c0cdd1','#b8c8ce'], rabbit: ['#dac7aa','#c9958b','#f1e4d2'], owl: ['#92765a','#b59872','#e6d6b1'],
    cat: ['#efd6a4','#df9b9a','#fff0d2'], wolf: ['#82979c','#b8c7c6','#dce3d9'], bear: ['#987055','#c69878','#ccb48c'],
    pig: ['#efbdba','#d9949a','#d98d98'], frog: ['#86a175','#abc286','#c4d39f'], gorilla: ['#4c5658','#74807e','#a2aba3']
  };
  let portraitSequence = 0;
  root.portrait = function (id, extra = '', state = 'neutral') {
    const [fur, inner, muzzle] = colors[id];
    const palette: Record<string, string> = { a: fur, b: inner, c: '#182c30', d: muzzle, e: '#354044', f: '#293b3e', g: '#b67a42' };
    const changed = state === 'good' || state === 'liar' || state === 'sad';
    const eyes: { x: number; y: number }[] = [];
    const rows = faces[id].map((row, y) => [...row].map((ch, x) => {
      if (!changed) return ch;
      if (ch === 'c') {
        eyes.push({ x, y });
        return ['owl', 'frog', 'gorilla'].includes(id) ? 'd' : 'a';
      }
      return ch === 'f' && y >= 8 ? 'd' : ch;
    }).join(''));
    let expression = '';
    if (id === 'cat') {
      // Keep the nose and whiskers visible through every expression change.
      expression += '<path d="M0.5 7 l3 1 M0.5 9 l3 -.5 M15.5 7 l-3 1 M15.5 9 l-3 -.5" fill="none" stroke="#69503e" stroke-width=".65"/>';
      expression += '<path d="M7 7.3 h2 l-1 1.2Z" fill="#c7747f"/>';
      if (!changed) {
        expression += '<path d="M8 8.5 v.4 M6.5 8.9 q.75 1.2 1.5 0 q.75 1.2 1.5 0" fill="none" stroke="#293b3e" stroke-width=".55"/>';
      }
    }
    if (changed) {
      for (const side of [eyes.filter(p => p.x < 8), eyes.filter(p => p.x >= 8)]) {
        const x = side.reduce((sum, p) => sum + p.x + .5, 0) / side.length;
        const y = side.reduce((sum, p) => sum + p.y + .5, 0) / side.length;
        const bend = state === 'good' ? -.7 : .6;
        expression += `<path d="M${x - 1} ${y} l1 ${bend} 1 ${-bend}" fill="none" stroke="#182c30" stroke-width=".65"/>`;
      }
      // The elephant's mouth is hidden behind its trunk in this front view.
      if (id !== 'elephant') {
        const mouthY = id === 'rabbit' ? 10 : id === 'pig' ? 10.5 : id === 'cat' ? 9 : ['owl', 'frog'].includes(id) ? 8.5 : 9.5;
        expression += `<path d="M6.5 ${mouthY} q1.5 ${state === 'good' ? 2 : -1.8} 3 0" fill="none" stroke="#293b3e" stroke-width=".65"/>`;
      }
      if (state === 'liar') {
        const gradientId = `jail-bar-${++portraitSequence}`;
        expression += `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#c0c8ca"/><stop offset="50%" stop-color="#26343c"/><stop offset="100%" stop-color="#c0c8ca"/></linearGradient></defs><path d="M13 5 l-1 2 q1 2 2 0Z" fill="#75b8d1"/>`;
        expression += [1.25, 5.25, 9.25, 13.25].map(x =>
          `<rect class="jail-bar" x="${x}" y="0" width="1.5" height="12" fill="url(#${gradientId})" shape-rendering="geometricPrecision"/>`
        ).join('');
      }
    }
    const rects = rows.flatMap((row, y) => [...row].flatMap((ch, x) => palette[ch] ? [`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`] : [])).join('');
    return `<svg class="portrait ${extra}" viewBox="0 0 16 12" data-portrait-state="${state}" aria-hidden="true" shape-rendering="crispEdges">${rects}${expression}</svg>`;
  };
})(globalThis);

/* Add readings to game text only; never parse user notes as HTML. */
(function () {
  'use strict';
  const readings = {
    '当てはまる':'あてはまる','合う':'あう','複数':'ふくすう','残る':'のこる','使い':'つかい','確かめ':'たしかめ','一方':'いっぽう',
    '開始':'かいし','選ん':'えらん','押し':'おし','発見':'はっけん','操作':'そうさ','不要':'ふよう',
    '信用':'しんよう','始まり':'はじまり','増え':'ふえ','減':'へ',
    '消えた':'きえた','広場':'ひろば','用意':'ようい','始まる':'はじまる','食べ':'たべ',
    '集まった':'あつまった','見つけ':'みつけ','図書館':'としょかん','絵本':'えほん',
    '大切':'たいせつ','隠され':'かくされ','花':'はな','足あと':'あしあと','公園':'こうえん',
    '近く':'ちかく','何':'なに','調べ':'しらべ','金':'きん','運動会':'うんどうかい',
    '渡す':'わたす','持ち去られ':'もちさられ','会場':'かいじょう','祭り':'まつり',
    '作った':'つくった','準備':'じゅんび','来て':'きて','郵便局':'ゆうびんきょく',
    '手紙':'てがみ','仕分け':'しわけ','本':'ほん',
    '1匹':'ぴき','2匹':'ひき','3匹':'びき','4匹':'ひき','5匹':'ひき','6匹':'ぴき','7匹':'ひき','8匹':'ぴき','9匹':'ひき','0匹':'ひき','匹':'ひき',
    '一度':'いちど','一致':'いっち','上部':'じょうぶ','上':'うえ','両方':'りょうほう','中':'なか',
    '事件':'じけん','設定':'せってい','以上':'いじょう','以下':'いか',
    '今回':'こんかい','仲介人':'ちゅうかいにん','何度':'なんど','供述書':'きょうじゅつしょ',
    '保存':'ほぞん','偶数':'ぐうすう','入門':'にゅうもん','全':'ぜん',
    '公開':'こうかい','内訳':'うちわけ','判定':'はんてい','済み':'ずみ','済':'ずみ','判明':'はんめい',
    '利用':'りよう','前回':'ぜんかい','前':'まえ','動物':'どうぶつ','一覧':'いちらん','参照先':'さんしょうさき',
    '各':'かく','合わ':'あわ','同じ':'おなじ','同時':'どうじ','問題':'もんだい','善人':'ぜんにん',
    '候補':'こうほ','嘘':'うそ','回':'かい','在席':'ざいせき','場合':'ばあい','場':'ば',
    '夜明け':'よあけ','奇数':'きすう','始め':'はじめ','少なく':'すくなく','届き':'とどき',
    '帳簿係':'ちょうぼがかり','形':'かたち','影響':'えいきょう','役割名':'やくわりめい',
    '心得':'こころえ','必ず':'かならず','必要':'ひつよう','情報屋':'じょうほうや','情報':'じょうほう',
    '意味':'いみ','戻る':'もどる','手':'て','押す':'おす','担当':'たんとう','探偵':'たんてい',
    '指定':'してい','挑戦':'ちょうせん','振り':'ふり','捜査':'そうさ','受付':'うけつけ','状況':'じょうきょう',
    '終了後':'しゅうりょうご','終了':'しゅうりょう','結果':'けっか','推理':'すいり','換わ':'かわ',
    '整理':'せいり','新しい':'あたらしい','方':'かた','明らか':'あきらか','最初':'さいしょ',
    '有効':'ゆうこう','未':'み','本当':'ほんとう','条件':'じょうけん','極秘':'ごくひ','資料':'しりょう',
    '横':'よこ','次':'つぎ','正しい':'ただしい','正しく':'ただしく','正体':'しょうたい','正解':'せいかい',
    '残り':'のこり','残し':'のこし','毎回':'まいかい','比べ':'くらべ','比較屋':'ひかくや',
    '気':'き','決ま':'きま','活かし':'いかし','減り':'へり','満たす':'みたす','照らし':'てらし',
    '照合':'しょうごう','犯人':'はんにん','現在':'げんざい','環境':'かんきょう','生成':'せいせい',
    '画面':'がめん','発言':'はつげん','目撃者':'もくげきしゃ','真偽':'しんぎ','真実':'しんじつ',
    '真相':'しんそう','矛盾':'むじゅん','確定':'かくてい','確認':'かくにん','種類':'しゅるい',
    '立場':'たちば','答え':'こたえ','組み':'くみ','続け':'つづけ','置き':'おき','聞こう':'きこう','聞く':'きく','聞いて':'きいて',
    '自動':'じどう','色':'いろ','表示':'ひょうじ','要検討':'ようけんとう','見張り':'みはり',
    '見抜け':'みぬけ','見抜き':'みぬき','解決':'かいけつ','記録係':'きろくがかり','証言':'しょうげん',
    '試し':'ためし','誤判定':'ごはんてい','説明':'せつめい','読み':'よみ','調査員':'ちょうさいん',
    '論理':'ろんり','返れ':'かえれ','通り':'とおり','通常':'つうじょう','進行':'しんこう',
    '遊び':'あそび','遊べ':'あそべ','違う':'ちがう','選べ':'えらべ','閉じ':'とじ','開き':'ひらき',
    '間違え':'まちがえ','間違っ':'まちがっ','関係者':'かんけいしゃ','限り':'かぎり','難易度':'なんいど',
    '難解':'なんかい','数':'かず','捜査中':'そうさちゅう','受付中':'うけつけちゅう'
  };
  // Match whole words for context, but annotate only their kanji runs.
  // Kana is aligned with the reading so okurigana stays outside <ruby>.
  const annotations = new Map(Object.entries(readings).map(([word, reading]) => {
    const parts = word.match(/[一-龯々]+|[^一-龯々]+/g)!;
    const alignment = new RegExp('^' + parts.map(part =>
      /^[一-龯々]+$/.test(part) ? '(.+?)' : part.replace(/[0-9]/g, '')
    ).join('') + '$');
    const match = reading.match(alignment);
    if (!match) throw new Error(`Invalid reading: ${word}`);
    let index = 1;
    return [word, parts.map(part => ({ text: part, reading: /^[一-龯々]+$/.test(part) ? match[index++] : null }))];
  }));
  const pattern = new RegExp(Object.keys(readings).sort((a, b) => b.length - a.length).join('|'), 'g');
  window.addReadings = function (root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('ruby, svg, script, style, textarea, select, option, noscript')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.textContent || "";
      const matches = [...text.matchAll(pattern)];
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.append(text.slice(offset, match.index));
        for (const part of annotations.get(match[0])!) {
          if (!part.reading) {
            fragment.append(part.text);
            continue;
          }
          const ruby = document.createElement('ruby');
          const rt = document.createElement('rt');
          ruby.append(part.text);
          rt.textContent = part.reading;
          ruby.append(rt);
          fragment.append(ruby);
        }
        offset = match.index + match[0].length;
      }
      fragment.append(text.slice(offset));
      node.replaceWith(fragment);
    }
  };
})();

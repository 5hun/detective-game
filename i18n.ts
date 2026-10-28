/* UI localization. Japanese is the default; language never changes puzzle logic. */
const DetectiveI18n = (() => {
  type Language = 'ja' | 'en';
  let language: Language = 'ja';
  const english: Record<string, string> = {
    関連する証言: 'Related testimony',
    '{0}に関連する証言': 'Testimony related to {0}',
    関連する証言を閉じる: 'Close related testimony',
    本人の証言: 'Own testimony',
    '{0}についての証言': 'Testimony about {0}',
    'この動物についての証言はありません。':
      'No other testimony mentions this animal.',
    元のカードへ: 'Go to card',
    ゾウ: 'Elephant',
    'ほかの1匹が犯人か善人かを証言する。':
      'Says whether one other animal is a culprit or innocent.',
    ウサギ: 'Rabbit',
    'ほかの2匹が同じ立場か、違う立場かを証言する。':
      'Says whether two other animals have the same or different roles.',
    フクロウ: 'Owl',
    '指定した3匹の中にいる犯人の数を証言する。':
      'States the exact number of culprits among three animals.',
    ネコ: 'Cat',
    '指定した2匹に少なくとも1匹、犯人がいるかを証言する。':
      'Says whether at least one of two animals is a culprit.',
    オオカミ: 'Wolf',
    '指定した2匹が両方とも犯人かを証言する。':
      'Says whether two animals are both culprits.',
    クマ: 'Bear',
    '指定した3匹の犯人の数が奇数か偶数かを証言する。':
      'Says whether the number of culprits among three animals is odd or even.',
    ブタ: 'Pig',
    '「Aが犯人で、Bが善人」という組み合わせかを証言する。':
      'Says whether the combination ‘A is a culprit and B is innocent’ is true.',
    カエル: 'Frog',
    '指定した3匹の中に犯人が2匹以上いるかを証言する。':
      'Says whether at least two of three animals are culprits.',
    イヌ: 'Dog',
    '自分より小さい番号と大きい番号で、犯人が多い側か同数かを証言する。自分は数に含めない。':
      'Compares the number of culprits with lower and higher numbers than its own. Does not count itself.',
    シカ: 'Deer',
    '指定した3匹が全員同じ立場か、犯人と善人が混ざっているかを証言する。':
      'Says whether three animals all have the same role or include both culprits and innocents.',
    消えたケーキ事件: 'The Missing Cake',
    '広場のパーティーに用意したケーキが、始まる前に食べられてしまいました。集まった動物たちの証言から、犯人を見つけましょう。':
      'The cake for the party in the square was eaten before the party began! Listen to the animals who gathered there and find the culprits.',
    '「ひと口だけ」のつもりが、気づけばお皿はからっぽに。ケーキを食べた犯人も手伝って、今度はみんなで大きなケーキを作りました。':
      'It was supposed to be ‘just one bite’, but soon the plate was empty. With help from the cake thieves, everyone made an even bigger cake together.',
    図書館の本事件: 'The Hidden Library Book',
    '図書館の大切な絵本が、だれかに隠されてしまいました。その場にいた動物たちの証言を聞いて、犯人を見つけましょう。':
      'Someone has hidden a treasured picture book from the library. Listen to the animals who were there and find the culprits.',
    '隠された絵本は、クッションの下で見つかりました。ひとりじめしたくなるほど面白いお話だったので、今日はみんなで読み聞かせの会を開きます。':
      'The picture book was found under a cushion. The story was so good that someone wanted it all to themselves. Today, everyone will enjoy a read-aloud together.',
    花だんの足あと事件: 'Footprints in the Flower Bed',
    '公園の花だんが、だれかにふみあらされてしまいました。近くにいた動物たちの証言から、何があったのか調べましょう。':
      'Someone has trampled the park’s flower bed. Listen to the animals nearby and find out what happened.',
    '花だんを横切ったのは、近道をしようとしたからでした。踏んでしまった花を植え直し、遠回りの道にも小さな花を飾りました。':
      'The culprits had crossed the flower bed to take a shortcut. They replanted the flowers and decorated the longer path with little flowers too.',
    金メダル事件: 'The Missing Gold Medal',
    '運動会で渡すはずの金メダルが、だれかに持ち去られてしまいました。会場にいた動物たちの証言を聞いて、犯人を見つけましょう。':
      'The gold medal for sports day has been taken! Listen to the animals at the event and find the culprits.',
    '金メダルは、こっそり開かれた表彰式で使われていました。優勝したのは「朝、ちゃんと起きられたで賞」。本物のメダルは返して、葉っぱのメダルを作ることになりました。':
      'The medal was being used at a secret award ceremony. The winning category? ‘Getting Up on Time!’ They returned the real medal and made medals out of leaves instead.',
    お祭りのかざり事件: 'The Broken Festival Decorations',
    'お祭りのために作ったかざりが、だれかにこわされてしまいました。準備に来ていた動物たちの証言から、犯人を見つけましょう。':
      'Someone has broken the decorations for the festival. Listen to the animals who came to help and find the culprits.',
    'かざりを壊してしまったのは、準備の途中で遊び始めたからでした。正直に謝ってつなぎ直すと、前より少し長くて、にぎやかなかざりになりました。':
      'The decorations broke when the culprits started playing during preparations. After an honest apology, they joined the pieces back together into a longer, livelier decoration.',
    郵便局の手紙事件: 'The Mixed-up Mail',
    '郵便局で仕分けた手紙が、だれかのいたずらでばらばらに。その場にいた動物たちの証言から、いたずらの犯人を見つけましょう。':
      'Someone has jumbled the letters sorted at the post office. Listen to the animals who were there and find the pranksters.',
    '手紙をばらばらにした犯人は、切手の絵を並べて眺めていました。手紙を元に戻したあと、郵便屋さんが使い終わった切手を少し分けてくれました。':
      'The culprits had spread out the letters to admire the pictures on the stamps. After they put everything back, the mail carrier gave them a few used stamps to keep.',
    遠足のおべんとう事件: 'The Picnic Lunch Mystery',
    '遠足のお昼休み、おべんとうの中身がだれかに食べられてしまいました。一緒に来た動物たちの証言から、犯人を見つけましょう。':
      'Someone has eaten the picnic lunches during a field trip! Listen to the animals on the trip and find the culprits.',
    'おべんとうを食べた犯人のおなかは、もういっぱい。それでも、みんなに謝るときには、おなかの奥がきゅっと小さくなりました。帰ったら、おわびのおべんとうを作ります。':
      'The culprits’ bellies were full, but they felt a little knot in their stomachs as they apologized. When they get home, they will make lunches for everyone to say sorry.',
    おもちゃ屋の積み木事件: 'The Toy Shop Castle',
    'お店に飾った大きな積み木のお城が、こわされてしまいました。遊びに来ていた動物たちの証言から、犯人を見つけましょう。':
      'The big building-block castle in the toy shop has been knocked down. Listen to the animals who came to play and find the culprits.',
    'お城を壊した犯人は、てっぺんにもう一つ積み木を載せようとしていました。今度はみんなで土台から作り直し、お店でいちばん大きなお城が完成しました。':
      'The culprits had tried to add just one more block to the top. Everyone rebuilt it together from the base, creating the biggest castle the shop had ever seen.',
    雪だるま事件: 'The Snowman’s Nose',
    'みんなで作った雪だるまの鼻が、持ち去られてしまいました。雪遊びをしていた動物たちの証言から、犯人を見つけましょう。':
      'The nose has been taken from the snowman everyone built. Listen to the animals playing in the snow and find the culprits.',
    '消えた鼻は、小さな雪うさぎの顔についていました。雪だるまに鼻を返してから、雪うさぎには木の実の鼻を探してあげました。':
      'The missing nose was on a little snow rabbit. After returning it to the snowman, they found a berry for the rabbit’s nose.',
    すっぱいレモネード事件: 'The Sour Lemonade',
    'お店のレモネードに、だれかがレモンを追加しました。ひと口飲むと、みんな同じ顔になってしまいます。お店にいた動物たちの証言から、犯人を見つけましょう。':
      'Someone has added extra lemon to the shop’s lemonade. One sip makes everyone pull the same face! Listen to the animals in the shop and find the culprits.',
    '「もっとおいしくなるはず」と足したレモンは、少し多すぎたようです。はちみつと水で味を整えたら、今度はみんな、にっこり同じ顔になりました。':
      'They thought more lemon would make it tastier, but added a little too much. Some honey and water fixed the flavor. Now everyone has the same face again—a smile.',
    ものほし場の旗事件: 'The Handkerchief Flag',
    'ものほし場のハンカチが、全部つながれて長い旗になっていました。風になびいて、なんだかお祭りのようです。近くにいた動物たちの証言から、犯人を見つけましょう。':
      'All the handkerchiefs on the washing line have been tied into a long flag. It flutters like a festival banner! Listen to the animals nearby and find the culprits.',
    'ハンカチをつないだ犯人は、広場に大きな旗を飾りたかったのでした。持ち主に謝って一枚ずつ返すと、「次は古い布で作ろうよ」と、お祭りの相談が始まりました。':
      'The culprits wanted a big flag for the square. They apologized and returned each handkerchief. ‘Let’s use old fabric next time!’ someone said, and festival planning began.',
    お茶会の席札事件: 'The Tea Party Place Cards',
    'お茶会の席札が、「くいしんぼうさま」「ねぼすけさま」などに書き換えられていました。なぜか全員、迷わず座っています。お茶会に来た動物たちの証言から、犯人を見つけましょう。':
      'The tea party place cards now say things like ‘Sleepyhead’ and ‘Big Eater’. Somehow, everyone knows where to sit! Listen to the guests and find the culprits.',
    '席札を書き換えた犯人は、みんなを笑わせたかったようです。「次は自分の札だけね」と約束して、席札を元に戻しました。でも「くいしんぼうさま」の札だけは、おかわりのお皿の前に残りました。':
      'The culprits just wanted to make everyone laugh. They promised to change only their own cards next time and put the names back. But ‘Big Eater’ stayed beside the plate of second helpings.',
    かんたん: 'Easy',
    ふつう: 'Normal',
    むずかしい: 'Hard',
    犯人: 'a culprit',
    勘違いしている善人: 'a mistaken innocent',
    善人: 'innocent',
    '、': ', ',
    '私より小さい番号と大きい番号では、犯人の数が同じだ。':
      'There are equally many culprits with lower numbers and higher numbers than mine.',
    '私より{0}番号のほうが、犯人が多い。':
      'There are more culprits with {0} numbers than mine.',
    小さい: 'lower',
    大きい: 'higher',
    '{0}の3匹は、全員同じ立場だ。':
      'These three animals ({0}) all have the same role.',
    '{0}の3匹には、犯人と善人が混ざっている。':
      'These three animals ({0}) include both culprits and innocents.',
    '{0}は{1}だ。': '{0} is {1}.',
    '{0}と{1}は、{2}だ。': '{0} and {1} have {2}.',
    同じ立場: 'the same role',
    違う立場: 'different roles',
    '{0}の3匹のうち、犯人はちょうど{1}匹だ。':
      'Among these three animals ({0}), there are exactly {1} culprits.',
    '{0}と{1}のうち、少なくとも1匹は犯人だ。':
      'At least one of {0} and {1} is a culprit.',
    '{0}と{1}は、両方とも善人だ。': '{0} and {1} are both innocent.',
    '{0}と{1}は、両方とも犯人だ。': '{0} and {1} are both culprits.',
    '{0}と{1}のうち、少なくとも1匹は善人だ。':
      'At least one of {0} and {1} is innocent.',
    '{0}の3匹のうち、犯人の数は{1}だ。':
      'Among these three animals ({0}), the number of culprits is {1}.',
    '奇数（1匹か3匹）': 'odd (1 or 3)',
    '偶数（0匹か2匹）': 'even (0 or 2)',
    '{0}は{1}で、{2}は{3}だ。': '{0} is {1}, and {2} is {3}.',
    '{0}の3匹のうち、犯人は{1}だ。':
      'Among these three animals ({0}), there are {1} culprits.',
    '2匹以上': 'at least 2',
    '1匹以下': 'at most 1',
    未設定: 'Unmarked',
    犯人候補: 'Possible culprit',
    善人候補: 'Possibly innocent',
    要検討: 'Needs thought',
    勘違い候補: 'Possibly mistaken',
    'この環境では保存できません（現在の画面では遊べます）':
      'Saving is unavailable in this browser. You can still play on this page.',
    勘違いしている: 'a mistaken',
    '<span class="mistaken-emphasis">勘違い</span><span class="identity-connector">している</span>':
      '<span class="mistaken-emphasis">a mistaken</span>',
    '<span class="resolved-tag {0}">{1} · {2}は{3}</span>':
      '<span class="resolved-tag {0}">{1} · {2} is {3}</span>',
    '✅ 正解': '✅ Correct',
    '❌ 誤判定': '❌ Incorrect',
    '<span class="resolved-tag revealed">✓ {0}と確定 · {1}は{2}</span>':
      '<span class="resolved-tag revealed">✓ Confirmed {0} · {1} is {2}</span>',
    '<span class="resolved-tag unjudged">未判定 · 真相：{0}</span>':
      '<span class="resolved-tag unjudged">Not judged · Actual role: {0}</span>',
    '<button class="judge liar" data-judge="liar" data-index="{0}" aria-label="{1}を犯人と判定"><span class="judge-icon" aria-hidden="true">😈</span><span>犯人と判定</span></button>':
      '<button class="judge liar" data-judge="liar" data-index="{0}" aria-label="Judge {1} as a culprit"><span class="judge-icon" aria-hidden="true">😈</span><span>Judge as culprit</span></button>',
    '<details class="truth-detail"><summary>真相と証言の照合：この証言は{0}</summary><p>{1}</p><p>この組み合わせでは、上の証言は{2}。{3}が{4}という真相と一致します。</p></details>':
      '<details class="truth-detail"><summary>Check the testimony: this statement is {0}</summary><p>{1}</p><p>With these roles, the statement above is {2}. This fits {3} being {4}.</p></details>',
    嘘: 'a lie',
    '勘違い（間違い）': 'mistaken (false)',
    本当: 'true',
    '{0}＝{1}': '{0} = {1}',
    ' ／ ': ' / ',
    正しい: 'true',
    間違っています: 'false',
    '<article class="suspect" data-marker="{0}" id="person-{1}" aria-labelledby="name-{2}"><div class="card-main"><div class="portrait-box"><span class="person-number">{3}</span>{4}</div><div class="person-content"><div class="person-heading"><h3 id="name-{5}">{6}. {7}</h3><details class="role-details"><summary>証言ルール</summary><p>{8}</p></details></div><div id="statement-{9}"><p class="statement">{10}</p></div><div class="actions">{11}</div></div></div><div class="memo-row"><div class="marker-group" role="group" aria-label="{12}のマーカー">{13}</div><label class="memo-label" for="memo-{14}">MEMO</label><textarea id="memo-{15}" data-note="{16}" aria-label="{17}の捜査メモ" maxlength="1000" rows="1" placeholder="きになることをメモ…"></textarea></div>{18}</article>':
      '<article class="suspect" data-marker="{0}" id="person-{1}" aria-labelledby="name-{2}"><div class="card-main"><div class="portrait-box"><span class="person-number">{3}</span>{4}</div><div class="person-content"><div class="person-heading"><h3 id="name-{5}">{6}. {7}</h3><details class="role-details"><summary>Testimony rule</summary><p>{8}</p></details></div><div id="statement-{9}"><p class="statement">{10}</p></div><div class="actions">{11}</div></div></div><div class="memo-row"><div class="marker-group" role="group" aria-label="Markers for {12}">{13}</div><label class="memo-label" for="memo-{14}">MEMO</label><textarea id="memo-{15}" data-note="{16}" aria-label="Investigation notes for {17}" maxlength="1000" rows="1" placeholder="Write your clues here…"></textarea></div>{18}</article>',
    '<button class="marker-button" style="--dot:{0}" data-marker-value="{1}" data-index="{2}" aria-label="{3}：{4}" title="{5}" aria-pressed="{6}"></button>':
      '<button class="marker-button" style="--dot:{0}" data-marker-value="{1}" data-index="{2}" aria-label="{3}: {4}" title="{5}" aria-pressed="{6}"></button>',
    '事件 {0} / {1}': 'Case {0} / {1}',
    解決済み: 'Solved',
    今回の捜査: 'Current case',
    これから: 'Upcoming',
    '<li class="campaign-step{0}{1}"{2} aria-label="捜査 {3}：{4}"><span aria-hidden="true">{5}</span></li>':
      '<li class="campaign-step{0}{1}"{2} aria-label="Case {3}: {4}"><span aria-hidden="true">{5}</span></li>',
    '{0} — どうぶつ探偵': '{0} — Animal Detective',
    '犯人 {0}匹': 'Culprits: {0}',
    '善人 {0}匹': 'Innocents: {0}',
    '（うち<strong class="mistaken-emphasis">勘違い</strong>している<strong class="identity-good">善人</strong>{0}匹）':
      '(<strong class="mistaken-emphasis">Mistaken</strong> <strong class="identity-good">innocents</strong>: {0})',
    勘違いしている善人について: 'About mistaken innocents',
    '１': '1',
    '０': '0',
    'この事件には、勘違いしている善人がいます。証言は必ず間違っていますが、犯人ではありません。\n「同じ立場」や犯人の数では善人として扱います。':
      'There are mistaken innocents in this case. Their testimony is always false, but they are not culprits.\nThey count as innocent when comparing roles or counting culprits.',
    '残り捜査資金 {0}': 'Investigation funds remaining: {0}',
    '<button type="button" class="testimony-link" data-person="{0}" style="--marker-color:{1}" aria-label="{2}の証言へ移動（{3}）" title="{4}：{5}">{6}</button>':
      '<button type="button" class="testimony-link" data-person="{0}" style="--marker-color:{1}" aria-label="Go to {2}’s testimony ({3})" title="{4}: {5}">{6}</button>',
    '証言を読み比べて、犯人を見つけましょう。':
      'Compare the animals’ statements to find the culprits.',
    次の事件へ: 'Next case',
    もう一度挑戦: 'Try again',
    'すべての事件を解決！': 'All cases solved!',
    '事件解決！ ({0} / {1})': 'Case solved! ({0} / {1})',
    '今回の捜査は、ここまで': 'Investigation ended',
    '<p>おめでとうございます！<br>あなたの推理で、全{0}件の事件が解決しました。<br>森の名探偵、おつかれさまでした！</p><table class="campaign-results" aria-label="全事件の結果"><tbody><tr><th scope="row">解決した事件</th><td>{1}件</td></tr><tr><th scope="row">全事件で間違えて犯人と判定した回数</th><td>{2}回</td></tr></tbody></table>{3}':
      '<p>Congratulations!<br>Your deductions solved all {0} cases.<br>Well done, detective of the forest!</p><table class="campaign-results" aria-label="Campaign results"><tbody><tr><th scope="row">Cases solved</th><td>{1}</td></tr><tr><th scope="row">Incorrect accusations across all cases</th><td>{2}</td></tr></tbody></table>{3}',
    '<p><strong>一度も間違えずに、すべての事件を解決しました！🎉</strong></p>':
      '<p><strong>You solved every case without a single mistake! 🎉</strong></p>',
    '事件解決。捜査資金 ＋{0}。{1}': 'Case solved. Funds +{0}. {1}',
    '一度も間違えず、みんなの正体を見抜きました。':
      'You uncovered every role without a single mistake.',
    '誤判定 {0}回で、みんなの正体が明らかになりました。':
      'All roles were revealed. Incorrect accusations: {0}.',
    '捜査資金がマイナスになりました。証言と真相を照らし合わせて、次の捜査に活かしましょう。':
      'Your funds fell below zero. Compare the testimony with the truth and use what you learn in your next investigation.',
    '<p>次の捜査へ進みましょう。</p>': '<p>Let’s move on to the next case.</p>',
    '{0}<h2>{1}</h2>{2}<p>各カードの「真相と証言の照合」で振り返れます。</p>{3}{4}<button class="primary-button" id="next-case">{5}</button>':
      '{0}<h2>{1}</h2>{2}<p>Review each card’s ‘Check the testimony’ section.</p>{3}{4}<button class="primary-button" id="next-case">{5}</button>',
    '<p>{0} / {1}の事件を解決しました。最初から挑戦できます。</p>':
      '<p>You solved {0} / {1} cases. You can try again from the beginning.</p>',
    最後の事件のその後: 'After the final case',
    事件のその後: 'What happened next',
    '事件 {0}': 'Case {0}',
    '捜査資金を引き継いで、新しい事件の捜査を始めましょう。':
      'Your funds carry over. Let’s begin a new investigation.',
    '新しい事件が届きました。みんなの証言が、捜査の手がかりです。':
      'A new case has arrived. Everyone’s testimony holds a clue.',
    どうぶつ探偵: 'Animal Detective',
    '前回の捜査結果を開きました。新しい事件にも挑戦できます。':
      'Your previous investigation results are open. You can also start a new case.',
    '{0}{1}は{2}でした。': '{0} {1} was {2}.',
    '✅ 正解です。捜査資金の増減はありません。':
      '✅ Correct. Your funds stay the same.',
    '❌ 誤判定。捜査資金 −1。': '❌ Incorrect. Funds −1.',
    '{0}の証言へ移動（{1}）': 'Go to {0}’s testimony ({1})',
    '{0}：{1}': '{0}: {1}',
    '動物たちの証言から嘘つきを見つける、何度でも遊べる論理推理ゲーム。':
      'A replayable logic mystery game: find the liars by comparing the animals’ testimony.',
    'どうぶつ探偵 ホーム': 'Animal Detective home',
    最初から: 'Restart',
    'home.start': 'New Game',
    遊び方: 'Help',
    ゲームメニュー: 'Game menu',
    動物一覧: 'Animal guide',
    効果音: 'Sound effects',
    効果音を切り替える: 'Toggle sound effects',
    おと: 'Sound ',
    ルビ: 'Furigana ',
    ルビを切り替える: 'Toggle Japanese reading guides',
    データの消去: 'Delete saved game',
    '動物たちの証言を読み比べて、': 'Compare the animals’ testimony',
    '嘘をつく犯人を見つけましょう。': 'and find the culprits who are lying.',
    '善人は本当のことを、犯人は嘘を話します。':
      'Innocents tell the truth; culprits lie.',
    '難易度ごとの事件に挑戦しましょう。':
      'Choose a difficulty and solve its cases.',
    続きから: 'Continue',
    捜査の進行状況: 'Investigation progress',
    事件の情報: 'Case information',
    この事件の内訳: 'Animals in this case',
    発見した犯人: 'Culprits found',
    匹: '',
    残り捜査資金: 'Funds remaining',
    動物の証言へ移動: 'Jump to an animal’s testimony',
    関係者一覧: 'Animals involved',
    すべての動物: 'All animals',
    動物一覧を閉じる: 'Close animal guide',
    '全10種類。どの動物も善人・犯人になり、「むずかしい」の4回目からは善人のうち1匹が勘違いします。':
      'There are 10 animal types. Any animal can be innocent or a culprit. From case 4 on Hard, one innocent is mistaken.',
    遊び方を閉じる: 'Close help',
    '捜査を始める前に。': 'Before you investigate',
    '動物たちの証言を読み、': 'Read the animals’ testimony, find ',
    'を見つけて「犯人と判定」を押しましょう。':
      ' and press ‘Judge as culprit’.',
    '証言を読み比べよう。': 'Compare the testimony.',
    'すべての動物の証言は最初から表示されています。証言を読み比べて、犯人を推理しましょう。':
      'Every animal’s testimony is displayed from the start. Compare the statements to work out who the culprits are.',
    '数が、最初の手がかり。': 'The numbers are your first clue.',
    '犯人と善人の数、善人のうち勘違いしている数は事件の上部に表示されます。':
      'The counts of culprits, innocents, and mistaken innocents appear at the top of each case.',
    '善人は真実を、犯人は嘘を。': 'Innocents tell the truth; culprits lie.',
    'すべての証言と数の条件から真相は一つに決まります。証言を読み比べ、判定で正体を確かめましょう。「むずかしい」の4回目から、証言が必ず間違っている善人が1匹登場します。この勘違いしている善人も犯人ではなく、犯人と判定すると捜査資金が1減ります。「同じ立場」は両方善人、または両方犯人という意味で、勘違いしている善人も善人として扱います。犯人がこの動物を「犯人だ」と証言することもあります。':
      'All the testimony and counts together give exactly one solution. Compare the statements and use judgments to uncover the truth. From case 4 on Hard, one innocent always gives false testimony because they are mistaken. They are still innocent: accusing them costs 1 fund. ‘The same role’ means both innocent or both culprits; a mistaken innocent counts as innocent. A culprit may falsely claim this animal is a culprit.',
    '種類ごとに、証言の形が違う。':
      'Each animal has its own kind of testimony.',
    '同じ動物は1事件に1匹だけ。動物名の横の「証言ルール」で説明を確認できます。':
      'Each animal type appears at most once per case. Open ‘Testimony rule’ beside an animal’s name to learn how it speaks.',
    '判定は、その場で確定。': 'Every judgment is final.',
    '捜査資金は3から始まり、正解しても増えません。間違えると1減り、事件を解決すると常に1増えます。間違えた場合も正体が判明します。捜査資金がマイナスになると捜査終了。選んだ難易度の事件をすべて解決するとゲームクリアです。次の事件でも捜査資金は引き継ぎ、動物や犯人の数が増えます。捜査資金が0以上の状態で犯人をすべて見つければ解決です。残りは善人と確定し、判定の操作は不要です。':
      'You start with 3 funds. Correct judgments cost nothing and earn nothing; incorrect judgments cost 1. Solving a case always earns 1 fund. Even an incorrect judgment reveals the animal’s role. The investigation ends if your funds fall below 0. Solve every case at your chosen difficulty to win. Funds carry over to the next case, where the number of animals and culprits increases. Find all the culprits with at least 0 funds to solve a case. The remaining animals are confirmed innocent automatically.',
    'メモは、あなただけの手がかり。': 'Keep your own notes.',
    '色マーカーは未設定・犯人候補・善人候補・要検討・勘違い候補から選べます。マーカーやメモは判定に影響しません。':
      'Choose a marker: Unmarked, Possible culprit, Possibly innocent, Needs thought, or Possibly mistaken. Notes and markers do not affect judgments.',
    '進行状況はこのブラウザに保存します。保存を利用できない環境でも、そのまま遊べます。終了後には各証言の真偽と参照先の正体を確認できます。':
      'Progress is saved in this browser. You can still play if saving is unavailable. After a case ends, review each statement’s truth and the roles of the animals it refers to.',
    捜査に戻る: 'Back to the investigation',
    結果を閉じる: 'Close results',
    結果を確認: 'Review results',
    '次の事件へ →': 'Next case →',
    最初から捜査: 'Start a new investigation',
    '難易度を選んで、捜査を始めましょう。': 'Choose a difficulty to begin.',
    '最初から始めると、捜査の進行とメモをリセットし、捜査資金は3に戻ります。':
      'Starting over resets your progress and notes and restores your funds to 3.',
    難易度: 'Difficulty',
    キャンセル: 'Cancel',
    捜査を開始: 'Start investigation',
    'データを消去しますか？': 'Delete your saved game?',
    '捜査の進行とメモをすべて消去します。消去したデータは元に戻せません。':
      'This deletes all investigation progress and notes. Deleted data cannot be restored.',
    '消去できませんでした。ブラウザの保存設定を確認してください。':
      'Could not delete the save. Check your browser’s storage settings.',
    消去する: 'Delete save',
    'このゲームにはJavaScriptがひつようです。ブラウザのせっていでゆうこうにしてください。':
      'This game requires JavaScript. Please enable it in your browser settings.',
    '「{0}が{1}」「{2}が{3}」の少なくとも一方が当てはまる。':
      'At least one of these statements is true: “{0} is {1}” or “{2} is {3}”.',
  };
  function text(
    message: string | TemplateStringsArray,
    ...values: unknown[]
  ): string {
    const source =
      typeof message === 'string'
        ? message
        : message.map((part, i) => (i ? `{${i - 1}}` : '') + part).join('');
    const translated = language === 'en' ? (english[source] ?? source) : source;
    // A single pass keeps inserted values (including braces) literal.
    return translated.replace(/\{(\d+)\}/g, (match, index: string) =>
      Number(index) < values.length ? String(values[Number(index)]) : match,
    );
  }
  const originals = new WeakMap<Element, Map<string, string>>();
  function localizePage() {
    document.documentElement.lang = language;
    for (const element of document.querySelectorAll(
      '[data-i18n], [data-i18n-aria-label], [data-i18n-title], [data-i18n-content], [data-i18n-alt], [data-i18n-placeholder]',
    )) {
      let original = originals.get(element);
      if (!original) {
        original = new Map();
        originals.set(element, original);
      }
      for (const attribute of [
        'text',
        'aria-label',
        'title',
        'content',
        'alt',
        'placeholder',
      ]) {
        if (
          !element.hasAttribute(
            attribute === 'text' ? 'data-i18n' : `data-i18n-${attribute}`,
          )
        )
          continue;
        if (!original.has(attribute))
          original.set(
            attribute,
            (attribute === 'text'
              ? element.textContent
              : element.getAttribute(attribute)
            )?.trim() || '',
          );
        // Explicit keys distinguish labels that share the same Japanese text.
        const source =
          attribute === 'text' && language === 'en'
            ? element.getAttribute('data-i18n') || original.get(attribute)!
            : original.get(attribute)!;
        const value = text(source);
        if (attribute === 'text') element.textContent = value;
        else element.setAttribute(attribute, value);
      }
    }
  }
  return {
    text,
    localizePage,
    get language() {
      return language;
    },
    setLanguage(value: Language) {
      language = value;
    },
  };
})();

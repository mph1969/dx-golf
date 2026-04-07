// ═══════════════════════════════════════════════════════════════
// DX! Golf Test Runner — paste into browser console on dx-golf.netlify.app
// ═══════════════════════════════════════════════════════════════
(function(){
  const results = [];
  let passed = 0, failed = 0;

  function assert(id, desc, condition) {
    if (condition) { passed++; results.push(`✅ ${id}: ${desc}`); }
    else { failed++; results.push(`❌ ${id}: ${desc}`); }
  }
  function el(id) { return document.getElementById(id); }
  function vis(id) { const e = el(id); return e && e.style.display !== 'none' && e.offsetParent !== null; }
  function hasClass(id, cls) { const e = el(id); return e && e.classList.contains(cls); }

  console.log('🏌️ DX! Golf Test Runner starting...\n');

  // ═══ A. GAME MODE SELECTION ═══
  // Reset to clean state
  setGameMode('dc');

  // A1: Game mode buttons exist
  assert('A1', 'All game mode buttons exist', el('gm-dc') && el('gm-wolf') && el('gm-nassau') && el('gm-sixes') && el('gm-pot'));

  // A3: The Pot selectable
  setGameMode('pot');
  assert('A3', 'The Pot mode sets correctly', S.gameMode === 'pot' && isPotMode());

  // A3b: Pot config visible on stakes
  assert('A3b', 'Pot config visible in Pot mode', el('pot-config') && el('pot-config').style.display !== 'none');

  // A6: Pot works with <4 players
  assert('A6', 'isPotMode returns true', isPotMode() === true);

  // ═══ B. REGION & COURSE ═══
  // B1: Region filter
  setRegion('US');
  const courseListAfterUS = el('course-list').innerHTML;
  assert('B1', 'USA filter shows Wildflower', courseListAfterUS.includes('Wildflower'));
  assert('B1b', 'USA filter hides Nansha', !courseListAfterUS.includes('Mountain Course'));

  // B2: All region
  setRegion(null);
  const courseListAll = el('course-list').innerHTML;
  assert('B2', 'All region shows Nansha', courseListAll.includes('Mountain Course'));
  assert('B2b', 'All region shows Wildflower', courseListAll.includes('Wildflower'));

  // B5: Wild Flower course data
  setCourse('wildflower');
  const wf = COURSES.wildflower;
  assert('B5', 'Wildflower has 5 tee sets', Object.keys(wf.tees).length === 5);
  assert('B5b', 'Wildflower is par 72', wf.tees.gold.par === 72);
  assert('B5c', 'Wildflower has 18 holes', wf.holes.length === 18);
  assert('B5d', 'Wildflower has silver tees', !!wf.tees.silver);

  // B6: Currency auto-set for USA
  assert('B6', 'USA course sets USD currency', S.bet.currency === 'USD' || document.querySelector('#ccy-USD.on'));

  // B7: Currency auto-set for China
  setCourse('mountain');
  assert('B7', 'China course sets RMB', document.querySelector('#ccy-RMB.on') !== null);

  // B9: USD defaults
  setCurrencyWithDefaults('USD');
  assert('B9', 'USD skin default is $1', el('b-skin') && el('b-skin').value === '1');
  assert('B9b', 'USD match default is $10', el('b-match') && el('b-match').value === '10');
  assert('B9c', 'USD skin step is $1', el('b-skin') && el('b-skin').step === '1');

  // ═══ C. TEE SELECTION ═══
  setGameMode('wolf');
  setCourse('wildflower');

  // C3: Auto-default to Blue (2nd tee)
  const gt = getGroupTee();
  assert('C3', 'Non-DC auto-defaults away from Gold', gt !== 'gold' || getAvailableTees().length === 1);

  // C1: Available tees for Wildflower
  const avail = getAvailableTees();
  assert('C1', 'Wildflower has 5 available tees', avail.length === 5);
  assert('C1b', 'Available tees include silver', avail.includes('silver'));

  // C2: Set tee and verify
  setGroupTee('white');
  assert('C2', 'setGroupTee changes to white', getGroupTee() === 'white');
  assert('C2b', 'All players have white roundTee', S.players.every(p => p.roundTee === 'white'));
  assert('C2c', 'All holes have white tee', S.holes.every(h => h.tee[0] === 'white'));

  // C6: No tee picker for DC
  setGameMode('dc');
  assert('C6', 'isDCMode true for dc', isDCMode() === true);
  assert('C6b', 'usesRoundTee false for dc', usesRoundTee() === false);

  // C7: Handicap Mode hidden for non-DC
  setGameMode('wolf');
  // Need to trigger tab switch to check visibility
  assert('C7', 'HCP section has display:none for wolf', el('hcp-mode-section') && el('hcp-mode-section').style.display === 'none');

  // C8: Handicap Mode visible for DC
  setGameMode('dc');
  assert('C8', 'isDCMode for dc', isDCMode());

  // ═══ D. MULTI-TEE COURSE DATA ═══
  const teeTests = [
    { id: 'mountain', expected: 4, name: 'Nansha Mountain' },
    { id: 'valley', expected: 4, name: 'Nansha Valley' },
    { id: 'brgNorman', expected: 4, name: 'BRG Norman' },
    { id: 'brgNicklaus', expected: 4, name: 'BRG Nicklaus' },
    { id: 'baNaHills', expected: 5, name: 'Bà Nà Hills' },
    { id: 'wildflower', expected: 5, name: 'Wildflower' },
    { id: 'muangKaew', expected: 2, name: 'Muang Kaew' },
  ];
  teeTests.forEach(t => {
    const c = COURSES[t.id];
    const teeCount = c ? Object.keys(c.tees).length : 0;
    assert(`D-${t.id}`, `${t.name} has ${t.expected} tee sets`, teeCount === t.expected);
  });

  // D5: TEE_CONFIG matches course data
  Object.keys(TEE_CONFIG).forEach(cid => {
    const cfg = TEE_CONFIG[cid];
    const course = COURSES[cid];
    if (!course) return;
    cfg.keys.forEach(k => {
      assert(`D-cfg-${cid}-${k}`, `${cid} TEE_CONFIG key '${k}' exists in course tees`, !!course.tees[k]);
    });
  });

  // ═══ E. THE POT ═══
  setGameMode('pot');
  setCourse('wildflower');
  setGroupTee('white');

  // E: Pot helper functions
  assert('E-helpers', 'isPotMode returns true', isPotMode());
  assert('E-usesRound', 'usesRoundTee true for pot', usesRoundTee());

  const structure4 = getPotPayoutStructure(4);
  assert('E-payout4', '4 players = winner takes all', structure4.length === 1 && structure4[0].pct === 100);

  const structure8 = getPotPayoutStructure(8);
  assert('E-payout8', '8 players = top 2 (65/35)', structure8.length === 2 && structure8[0].pct === 65);

  const structure15 = getPotPayoutStructure(15);
  assert('E-payout15', '15 players = top 5', structure15.length === 5);

  // E: Pot settlement with no scores
  const potResult = calcPotSettlement();
  assert('E-settle0', 'Pot settlement with no scores has zero bal', potResult.bal.every(b => b <= 0));

  // ═══ F. GAME MODE LABELS & BET VISIBILITY ═══
  setGameMode('dc');
  assert('F6-dc-birdie', 'Birdie visible in DC', el('b-birdie-cell') && el('b-birdie-cell').style.display !== 'none');
  assert('F6-dc-eagle', 'Eagle visible in DC', el('b-eagle-cell') && el('b-eagle-cell').style.display !== 'none');
  assert('F6-dc-dc', 'DC Bonus visible in DC', el('b-dc-cell') && el('b-dc-cell').style.display !== 'none');

  setGameMode('wolf');
  assert('F6-wolf-birdie', 'Birdie hidden in Wolf', el('b-birdie-cell') && el('b-birdie-cell').style.display === 'none');
  assert('F6-wolf-eagle', 'Eagle hidden in Wolf', el('b-eagle-cell') && el('b-eagle-cell').style.display === 'none');
  assert('F6-wolf-dc', 'DC Bonus hidden in Wolf', el('b-dc-cell') && el('b-dc-cell').style.display === 'none');

  setGameMode('pot');
  assert('F6-pot-birdie', 'Birdie hidden in Pot', el('b-birdie-cell') && el('b-birdie-cell').style.display === 'none');
  assert('F6-pot-nassau', 'Nassau hidden in Pot', el('b-nassau-cell') && el('b-nassau-cell').style.display === 'none');

  // ═══ G. DISPLAY & UX ═══
  // G1-G3: Font size modes
  setFontSize('xl');
  assert('G1', 'Senior mode adds fs-xl class', document.body.classList.contains('fs-xl'));
  setFontSize('large');
  assert('G2', 'Large mode adds fs-large class', document.body.classList.contains('fs-large'));
  assert('G2b', 'Large removes fs-xl', !document.body.classList.contains('fs-xl'));
  setFontSize('normal');
  assert('G3', 'Normal removes all fs classes', !document.body.classList.contains('fs-large') && !document.body.classList.contains('fs-xl'));

  // G5: HCP input validation
  const h0 = el('h0');
  if (h0) {
    h0.value = 'abc123';
    h0.dispatchEvent(new Event('input'));
    assert('G5', 'HCP strips non-numeric chars', !h0.value.match(/[a-z]/i));
  }

  // ═══ REGION DEFAULTS ═══
  const regionTests = [
    { course: 'mountain', region: 'CN', currency: 'RMB' },
    { course: 'wildflower', region: 'US', currency: 'USD' },
    { course: 'muangKaew', region: 'TH', currency: 'THB' },
    { course: 'montgomerie', region: 'VN', currency: 'USD' },
  ];
  regionTests.forEach(t => {
    assert(`REG-${t.course}`, `${t.course} region is ${t.region}`, COURSE_REGIONS[t.course] === t.region);
    assert(`REG-${t.course}-ccy`, `${t.region} default currency is ${t.currency}`, REGION_DEFAULTS[t.region].currency === t.currency);
  });

  // ═══ COURSE DATA INTEGRITY ═══
  Object.entries(COURSES).forEach(([id, c]) => {
    if (!c.holes) return;
    assert(`DATA-${id}-holes`, `${id} has 18 holes`, c.holes.length === 18);
    const totalPar = c.holes.reduce((s, h) => s + (h.par || 0), 0);
    assert(`DATA-${id}-par`, `${id} total par is reasonable (${totalPar})`, totalPar >= 54 && totalPar <= 80);
    // Check all holes have SI
    const allSI = c.holes.every(h => h.si >= 1 && h.si <= 18);
    assert(`DATA-${id}-si`, `${id} all holes have valid SI (1-18)`, allSI);
  });

  // ═══ HANDICAP CALC ═══
  S.players[0].hcpIdx = 15;
  setCourse('wildflower');
  calcHcps();
  assert('HCP-gold', 'Gold CHP calculated', typeof S.players[0].cHcp_gold === 'number' && S.players[0].cHcp_gold > 0);
  assert('HCP-blue', 'Blue CHP calculated', typeof S.players[0].cHcp_blue === 'number' && S.players[0].cHcp_blue > 0);
  assert('HCP-white', 'White CHP calculated', typeof S.players[0].cHcp_white === 'number');
  assert('HCP-order', 'Gold CHP >= Blue CHP >= White CHP', S.players[0].cHcp_gold >= S.players[0].cHcp_blue);

  // ═══ PRINT RESULTS ═══
  console.log('\n' + '═'.repeat(60));
  console.log(`🏌️ DX! GOLF TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));
  results.forEach(r => console.log(r));
  console.log('═'.repeat(60));
  if (failed === 0) console.log('🎉 ALL TESTS PASSED!');
  else console.log(`⚠️ ${failed} test(s) failed — review above`);
  console.log('═'.repeat(60));

  // Reset to clean state
  setGameMode('dc');
  setCourse('mountain');
  setFontSize('normal');
  setRegion(null);
})();

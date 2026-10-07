// 화면 전환, 프로필, HUD, 모달(놀이 방법·일시정지·클리어)
import { STAGES, getStage, sampleWord, GOAL } from './words.js';
import { splitWord } from './hangul.js';
import { Game } from './game.js';
import { Controls } from './controls.js';
import { drawPacman, drawGhost, drawTile, GHOST_COLORS } from './art.js';
import { audioPrefs, unlockAudio, sfx, speak } from './audio.js';
import { load, save, newProfile, defaultLayout, totalStars, isUnlocked } from './storage.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const AVATARS = ['🐰', '🐻', '🐱', '🐶', '🦊', '🐼', '🐸', '🐯', '🐧', '🦄', '🐹', '🐨'];

const data = load();
let profile = data.profiles.find((p) => p.id === data.currentId) || null;
let currentLevel = 1;
const persist = () => save(data);

// ---------- 게임 ----------
const gameScreen = $('#scr-game');
const game = new Game($('#cv'), { onHud: renderHud, onClear: showClear });
const controls = new Controls(gameScreen, game, {
  getLayout: () => (profile ? profile.layout : defaultLayout()),
  saveLayout: persist,
});
game.start();
if (location.hostname === 'localhost') window.__game = game; // 개발 중 확인용

// ---------- 화면 전환 ----------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `scr-${id}`));
  closeModal();
  if (id !== 'game') {
    game.idle();
    controls.setEditing(false);
  }
  ({ profile: renderProfiles, home: renderHome, settings: renderSettings })[id]?.();
}
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { sfx.tap(); show(b.dataset.back); }));

function applyProfile() {
  audioPrefs.sound = profile.sound;
  audioPrefs.voice = profile.voice;
  profile.blink = profile.blink ?? true;
  profile.layout = profile.layout || defaultLayout();
  game.blinkHints = profile.blink;
}

// ---------- 프로필 ----------
function drawLogo() {
  const c = $('.logo-art');
  const ctx = c.getContext('2d');
  let t = 0;
  const tick = () => {
    if (!$('#scr-profile').classList.contains('active')) return;
    t += 1 / 60;
    ctx.clearRect(0, 0, 320, 120);
    const x = 70 + Math.sin(t * 1.2) * 18;
    drawPacman(ctx, x, 60, 100, { x: 1, y: 0 }, (Math.sin(t * 9) + 1) / 2);
    drawTile(ctx, { jamo: 'ㄱ', wiggle: 0 }, 165, 60, 74, t, true);
    drawGhost(ctx, 262, 60, 96, GHOST_COLORS[0], { x: -1, y: 0 }, t, false, false);
    requestAnimationFrame(tick);
  };
  tick();
}

function renderProfiles() {
  const list = $('#profile-list');
  list.innerHTML = '';
  for (const p of data.profiles) {
    const b = document.createElement('button');
    b.className = 'profile';
    b.innerHTML = `<span class="av">${p.avatar}</span>${esc(p.name)}<br><span class="st">⭐ ${totalStars(p)}</span>`;
    b.onclick = () => {
      sfx.tap();
      profile = p;
      data.currentId = p.id;
      persist();
      applyProfile();
      show('home');
    };
    list.appendChild(b);
  }
  const add = document.createElement('button');
  add.className = 'profile add';
  add.innerHTML = '<span class="av">➕</span>새 친구';
  add.onclick = () => { sfx.tap(); showNewProfile(); };
  list.appendChild(add);
  drawLogo();
}

function showNewProfile() {
  let avatar = AVATARS[data.profiles.length % AVATARS.length];
  openModal(`
    <h2>새 친구 만들기</h2>
    <p>이름(별명)을 써 주세요</p>
    <input class="name-input" id="np-name" maxlength="8" placeholder="예: 지우" autocomplete="off">
    <div class="avatars" id="np-av">${AVATARS.map((a) => `<button data-a="${a}" class="${a === avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
    <div class="modal-actions">
      <button class="big-btn alt" id="np-cancel">취소</button>
      <button class="big-btn" id="np-ok">만들기</button>
    </div>`);
  $('#np-av').onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    avatar = a;
    $('#np-av').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
  };
  $('#np-cancel').onclick = closeModal;
  $('#np-ok').onclick = () => {
    const name = $('#np-name').value.trim() || `친구 ${data.profiles.length + 1}`;
    const p = newProfile(name, avatar);
    data.profiles.push(p);
    data.currentId = p.id;
    profile = p;
    persist();
    applyProfile();
    show('home');
  };
  setTimeout(() => $('#np-name')?.focus(), 50);
}

// ---------- 단계 선택 ----------
function renderHome() {
  $('#btn-who').textContent = `${profile.avatar} ${profile.name}`;
  $('#home-stars').textContent = totalStars(profile);
  const list = $('#stage-list');
  list.innerHTML = '';
  for (const st of STAGES) {
    const open = isUnlocked(profile, st.level);
    const stars = profile.stars[st.level] || 0;
    const ex = sampleWord(st);
    const exHtml = st.picture
      ? `${ex.emoji} ${'<span class="box"></span>'.repeat(splitWord(ex.word).syllables.length)}`
      : `${ex.emoji} ${ex.word}`;
    const b = document.createElement('button');
    b.className = `stage${open ? '' : ' locked'}`;
    b.innerHTML = `<span class="lv" style="background:${open ? st.deep : '#b5afcc'}">${st.level}단계</span>
      <span class="tt">${st.setTitle}</span>
      <span class="mode">${st.picture ? '🖼️ 그림만 보고' : '🔤 글자 보고'}</span>
      <span class="ex">${exHtml}</span>
      <span class="sr">${open ? '⭐'.repeat(stars) + '<span style="opacity:.25">' + '⭐'.repeat(3 - stars) + '</span>' : '🔒'}</span>`;
    if (open) b.onclick = () => { sfx.tap(); startStage(st.level); };
    list.appendChild(b);
  }
}
$('#btn-who').onclick = () => { sfx.tap(); show('profile'); };
$('#btn-settings').onclick = () => { sfx.tap(); show('settings'); };

function startStage(level) {
  currentLevel = level;
  show('game');
  game.resize();
  controls.apply();
  $('#btn-peek').hidden = !getStage(level).picture;
  const go = () => game.play(level);
  if (!profile.seenHow) showHow(go);
  else if (getStage(level).picture && !profile.seenPicture) showPictureHow(go);
  else go();
}

function showHow(then) {
  openModal(`
    <h2>놀이 방법 🟡</h2>
    <div class="how">
      <p><span class="ic">🎮</span>위에 나온 단어의 자음·모음을 <b>차례대로</b> 먹어요</p>
      <p><span class="ic">✨</span>게임 = ㄱ → ㅔ → ㅇ → ㅣ → ㅁ</p>
      <p><span class="ic">🙅</span>단어에 없는 글자는 먹어도 괜찮아요</p>
      <p><span class="ic">⏳</span>아직 차례가 아닌 글자는 먹을 수 없어요</p>
      <p><span class="ic">👻</span>유령을 피해요! 잡혀도 모은 글자는 그대로예요</p>
      <p><span class="ic">⭐</span>별사탕을 먹으면 유령을 잡을 수 있어요</p>
    </div>
    <div class="modal-actions"><button class="big-btn" id="how-go">시작! ▶</button></div>`);
  $('#how-go').onclick = () => {
    profile.seenHow = true;
    persist();
    closeModal();
    then();
  };
}

function showPictureHow(then) {
  openModal(`
    <h2>그림 단계 🖼️</h2>
    <div class="how">
      <p><span class="ic">🌳</span>이제 단어 대신 그림만 나와요</p>
      <p><span class="ic">🤔</span>그림을 보고 무슨 단어인지 생각해서 먹어요</p>
      <p><span class="ic">💡</span>모르겠으면 <b>글자 보기</b>를 눌러요 (5번까지)</p>
    </div>
    <div class="modal-actions"><button class="big-btn" id="how-go">시작! ▶</button></div>`);
  $('#how-go').onclick = () => {
    profile.seenPicture = true;
    persist();
    closeModal();
    then();
  };
}

// ---------- HUD ----------
let lastWordShown = false;
function renderHud(h) {
  $('#hud-score').textContent = h.score;
  $('#hud-bar').style.width = `${(h.index / h.goal) * 100}%`;
  $('#hud-count').textContent = `${Math.min(h.index + 1, h.goal)} / ${h.goal}`;
  $('#hud-peeks').textContent = h.peeks;
  $('#btn-peek').disabled = !h.canPeek;
  const slots = h.built
    .map((s, i) => `<span class="slot${h.sylDone[i] ? ' done' : s ? ' filled' : ''}">${s}</span>`)
    .join('');
  const word = h.showWord ? `<span class="word${h.picture && !lastWordShown ? ' peek' : ''}">${h.word}</span><span class="arrow">▶</span>` : '';
  lastWordShown = h.showWord;
  $('#hud-target').innerHTML = `<span class="emoji">${h.emoji}</span>${word}<span class="slots">${slots}</span>`;
}

$('#btn-peek').onclick = () => {
  if (game.usePeek()) sfx.magic();
};

// ---------- 모달 ----------
function openModal(html) {
  $('#modal-card').innerHTML = html;
  $('#modal').classList.add('open');
  controls.release();
}
function closeModal() {
  $('#modal').classList.remove('open');
}

function showClear(res) {
  const firstClear = !profile.stars[currentLevel];
  profile.stars[currentLevel] = Math.max(profile.stars[currentLevel] || 0, res.stars);
  persist();
  const hasNext = currentLevel < STAGES.length;
  openModal(`
    <h2>🎉 ${currentLevel}단계 클리어!</h2>
    <div class="stars-big">${[1, 2, 3].map((i) => `<span class="${i <= res.stars ? '' : 'off'}">⭐</span>`).join('')}</div>
    <p>단어 ${GOAL}개 완성 · 유령에게 잡힌 횟수 ${res.caught}번 · 점수 ${res.score}</p>
    ${firstClear && hasNext ? `<p>🔓 ${currentLevel + 1}단계가 열렸어요!</p>` : ''}
    ${!hasNext ? '<p>🏆 모든 단계를 끝냈어요! 정말 대단해요!</p>' : ''}
    <div class="modal-actions">
      <button class="big-btn alt" id="c-list">단계 선택</button>
      ${hasNext ? '<button class="big-btn" id="c-next">다음 단계 ▶</button>' : ''}
    </div>`);
  $('#c-list').onclick = () => show('home');
  if (hasNext) $('#c-next').onclick = () => startStage(currentLevel + 1);
}

// ---------- 일시정지 ----------
$('#btn-pause').onclick = () => {
  if (game.state === 'clear' || game.state === 'idle') return;
  sfx.tap();
  game.paused = true;
  openModal(`
    <h2>잠깐 쉬어요 ⏸</h2>
    <div class="modal-actions" style="flex-direction:column;align-items:center">
      <button class="big-btn" id="p-go">계속하기 ▶</button>
      <button class="big-btn alt" id="p-layout">🎮 방향키 위치 바꾸기</button>
      <button class="big-btn alt" id="p-quit">그만하기</button>
    </div>
    <p style="opacity:.7;margin-top:12px">그만하면 이번 단계는 처음부터 다시 해야 해요</p>`);
  $('#p-go').onclick = () => { closeModal(); game.paused = false; };
  $('#p-layout').onclick = () => { closeModal(); controls.setEditing(true); editFrom = 'pause'; };
  $('#p-quit').onclick = () => show('home');
};

// ---------- 방향키 위치 바꾸기 ----------
let editFrom = null;
function openLayoutEditor() {
  editFrom = 'settings';
  show('game');
  game.resize();
  game.idle();
  controls.apply();
  controls.setEditing(true);
}
$('#edit-swap').onclick = () => controls.swapSides();
$('#edit-smaller').onclick = () => controls.resize(-0.1);
$('#edit-bigger').onclick = () => controls.resize(0.1);
$('#edit-reset').onclick = () => {
  profile.layout = defaultLayout();
  persist();
  controls.apply();
};
$('#edit-done').onclick = () => {
  controls.setEditing(false);
  if (editFrom === 'pause') game.paused = false;
  else show('settings');
  editFrom = null;
};

// ---------- 설정 ----------
function renderSettings() {
  $('#set-sound').checked = profile.sound;
  $('#set-voice').checked = profile.voice;
  $('#set-blink').checked = profile.blink;
}
$('#set-sound').onchange = (e) => { profile.sound = e.target.checked; persist(); applyProfile(); sfx.tap(); };
$('#set-voice').onchange = (e) => { profile.voice = e.target.checked; persist(); applyProfile(); if (profile.voice) speak('안녕!'); };
$('#set-blink').onchange = (e) => { profile.blink = e.target.checked; persist(); applyProfile(); sfx.tap(); };
$('#set-layout').onclick = () => { sfx.tap(); openLayoutEditor(); };
$('#set-swap').onclick = () => {
  controls.swapSides();
  const leftHanded = profile.layout.pad.x > 0.5;
  openModal(`<h2>바꿨어요! ↔</h2><p>방향키가 <b>${leftHanded ? '오른쪽' : '왼쪽'}</b>에 있어요</p><div class="modal-actions"><button class="big-btn" id="sw-ok">좋아요</button></div>`);
  $('#sw-ok').onclick = closeModal;
};
$('#set-delete').onclick = () => {
  openModal(`<h2>정말 지울까요?</h2><p>${profile.avatar} ${esc(profile.name)}의 별과 진도가 모두 사라져요</p>
    <div class="modal-actions"><button class="big-btn alt" id="d-no">아니요</button><button class="big-btn" id="d-yes">지우기</button></div>`);
  $('#d-no').onclick = closeModal;
  $('#d-yes').onclick = () => {
    data.profiles = data.profiles.filter((p) => p.id !== profile.id);
    data.currentId = null;
    profile = null;
    persist();
    show('profile');
  };
};

// ---------- 키보드 (PC 테스트용) ----------
const KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
window.addEventListener('keydown', (e) => {
  if (!gameScreen.classList.contains('active') || $('#modal').classList.contains('open')) return;
  if (KEY_DIR[e.key]) {
    game.setWant(KEY_DIR[e.key]);
    e.preventDefault();
  } else if (e.key === 'h' || e.key === 'H') {
    $('#btn-peek').click();
  }
});

// 첫 터치에서 소리 켜기 (브라우저 정책)
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// 홈 화면에 설치된 앱(PWA)은 오프라인에서도 열리게
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- 시작 ----------
if (profile) {
  applyProfile();
  show('home');
} else show('profile');

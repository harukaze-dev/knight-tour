// client.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 할당 ---
    const themeToggle = document.getElementById('theme-toggle'), soundToggle = document.getElementById('sound-toggle');
    const timerElement = document.getElementById('timer');
    const gameSetup = document.getElementById('game-setup'), showModalButton = document.getElementById('show-modal-button');
    const gameBoardContainer = document.getElementById('game-board-container'), boardElement = document.getElementById('game-board');
    const messageElement = document.getElementById('message'), restartSameSizeButton = document.getElementById('restart-same-size-button'), chooseNewSizeButton = document.getElementById('choose-new-size-button');
    const modalOverlay = document.getElementById('modal-overlay'), modalCloseButton = document.getElementById('modal-close-button'), sizeOptionsContainer = document.getElementById('size-options-container');
    const rankingBoard = document.getElementById('ranking-board'), rankingBoardSizeSpan = document.getElementById('ranking-board-size'), startSelectedGameButton = document.getElementById('start-selected-game-button');
    const winModalOverlay = document.getElementById('win-modal-overlay'), winModalSizeSpan = document.getElementById('win-modal-size'), winModalTimeSpan = document.getElementById('win-modal-time');
    const nicknameEntryView = document.getElementById('nickname-entry-view'), rankResultView = document.getElementById('rank-result-view');
    const nicknameInput = document.getElementById('nickname-input'), submitRankButton = document.getElementById('submit-rank-button'), rankMessage = document.getElementById('rank-message');
    const winModalRankingBoard = document.getElementById('win-modal-ranking-board');
    const winModalRestartSameButton = document.getElementById('win-modal-restart-same'), winModalChooseNewButton = document.getElementById('win-modal-choose-new');
    const moveSound = document.getElementById('move-sound');

    // --- 게임 상태 및 설정 변수 ---
    const SQUARE_SIZE = 90;
    let rows, cols, totalSquares, boardState;
    let moveCount = 0, knightPosition = null, gameStarted = false, gameOver = false;
    let isSoundOn = true, selectedSize = null;
    let timerInterval = null, startTime = 0, clearTime = 0;
    const boardSizes = ['3x7','3x8','4x5','4x6','4x7','4x8','5x5','5x6','5x7','5x8','6x6','6x7','6x8','7x7','7x8','8x8'].sort();

    // --- 설정 관리 (테마, 사운드) ---
    const applyTheme = (theme) => { document.body.dataset.theme = theme; themeToggle.checked = theme === 'dark'; localStorage.setItem('theme', theme); };
    const applySoundSetting = (soundState) => { isSoundOn = soundState; soundToggle.textContent = isSoundOn ? '🔊' : '🔇'; localStorage.setItem('soundOn', isSoundOn); };

    // --- 타이머 관리 ---
    const formatTime = (ms) => { const totalSeconds = Math.floor(ms / 1000); const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0'); const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0'); const s = String(totalSeconds % 60).padStart(2, '0'); return `${h}:${m}:${s}`; };
    const startTimer = () => { startTime = Date.now(); timerInterval = setInterval(() => { timerElement.textContent = formatTime(Date.now() - startTime); }, 1000); };
    const stopTimer = () => { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; clearTime = Date.now() - startTime; } };
    const resetTimer = () => { stopTimer(); timerElement.textContent = '00:00:00'; };
    
    // --- 모달 관리 ---
    const openSizeModal = () => modalOverlay.classList.remove('hidden');
    const closeSizeModal = () => modalOverlay.classList.add('hidden');
    const openWinModal = () => winModalOverlay.classList.remove('hidden');
    const closeWinModal = () => winModalOverlay.classList.add('hidden');

    // --- 랭킹 및 API 통신 ---
    async function fetchAndDisplayRankings(size) {
        rankingBoard.innerHTML = '<li>로딩 중...</li>';
        try {
            const response = await fetch(`/api/rankings/${size}`);
            const rankings = await response.json();
            rankingBoard.innerHTML = '';
            if (rankings.length === 0) {
                rankingBoard.innerHTML = '<li>아직 랭킹이 없습니다.</li>';
                return;
            }
            rankings.forEach((record, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="rank-name">${index + 1}. ${record.name}</span> <span class="rank-time">${formatTime(record.time)}</span>`;
                rankingBoard.appendChild(li);
            });
        } catch (error) {
            console.error('랭킹 로딩 실패:', error);
            rankingBoard.innerHTML = '<li>랭킹을 불러올 수 없습니다.</li>';
        }
    }

    function displayWinModalRankings(rankings, myName, myTime) {
        winModalRankingBoard.innerHTML = '';
        if (rankings.length === 0) return;
        rankings.forEach((record, index) => {
            const li = document.createElement('li');
            if (record.name === myName && record.time === myTime) {
                li.classList.add('my-rank');
            }
            li.innerHTML = `<span class="rank-name">${index + 1}. ${record.name}</span> <span class="rank-time">${formatTime(record.time)}</span>`;
            winModalRankingBoard.appendChild(li);
        });
    }

    async function submitRanking() {
        const name = nicknameInput.value.trim();
        if (!name) { alert('닉네임을 입력해주세요.'); return; }
        submitRankButton.disabled = true;
        submitRankButton.textContent = '등록 중...';
        try {
            const response = await fetch('/api/rankings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, size: `${rows}x${cols}`, time: clearTime })
            });
            const result = await response.json();
            if (result.success) {
                rankMessage.textContent = `${name}님, ${rows}x${cols} 사이즈에서 ${result.rank}위를 달성했습니다!`;
                displayWinModalRankings(result.newRankings, name, clearTime);
                nicknameEntryView.classList.add('hidden');
                rankResultView.classList.remove('hidden');
            } else {
                alert('랭킹 등록에 실패했습니다: ' + result.message);
            }
        } catch (error) {
            console.error('랭킹 등록 실패:', error);
            alert('랭킹 등록 중 오류가 발생했습니다.');
        } finally {
            submitRankButton.disabled = false;
            submitRankButton.textContent = '랭킹 등록';
        }
    }

    // --- 게임 플레이 로직 ---

    // [추가] 오디오 컨텍스트 잠금 해제 함수
    function unlockAudioContext() {
        if (moveSound.paused) {
            moveSound.play().catch(() => {}); // 첫 재생 시도 (오류는 무시)
            moveSound.pause(); // 바로 멈춤
            moveSound.currentTime = 0;
        }
    }

    const playSound = () => {
        if (isSoundOn && moveSound) {
            moveSound.currentTime = 0;
            // [수정] play()는 Promise를 반환하므로 잠재적인 오류를 처리합니다.
            moveSound.play().catch(error => {
                console.log("오디오 재생에 실패했습니다. 사용자의 상호작용이 필요할 수 있습니다.", error);
            });
        }
    };

    const restartCurrentGame = () => initGame();

    function initGame() {
        if (!selectedSize && !rows) { alert("먼저 사이즈를 선택해주세요."); return; }
        if (selectedSize) { [rows, cols] = selectedSize.split('x').map(Number); }
        totalSquares = rows * cols;
        moveCount = 0;
        knightPosition = null;
        gameStarted = false;
        gameOver = false;
        messageElement.textContent = '나이트를 배치할 칸을 선택하세요.';
        boardState = Array(rows).fill(null).map(() => Array(cols).fill(0));
        gameSetup.classList.add('hidden');
        gameBoardContainer.classList.remove('hidden');
        createBoard();
        resetTimer();
    }

    function createBoard() {
        boardElement.innerHTML = '';
        boardElement.style.gridTemplateColumns = `repeat(${cols}, ${SQUARE_SIZE}px)`;
        boardElement.style.gridTemplateRows = `repeat(${rows}, ${SQUARE_SIZE}px)`;
        for (let i = 0; i < rows; i++) { for (let j = 0; j < cols; j++) { const square = document.createElement('div'); square.className = 'square'; square.classList.add((i + j) % 2 === 0 ? 'light' : 'dark'); square.dataset.row = i; square.dataset.col = j; square.addEventListener('click', handleSquareClick); boardElement.appendChild(square); } }
    }
    
    function handleSquareClick(event) { if (gameOver) return; const square = event.currentTarget, row = parseInt(square.dataset.row), col = parseInt(square.dataset.col); if (!gameStarted) { placeKnight(row, col); } else if (getValidMoves(knightPosition.row, knightPosition.col).some(m => m.row === row && m.col === col)) { moveKnight(row, col); } }
    
    function placeKnight(row, col) { gameStarted = true; startTimer(); moveCount = 1; knightPosition = { row, col }; boardState[row][col] = moveCount; updateBoard(); playSound(); }
    function moveKnight(row, col) { moveCount++; knightPosition = { row, col }; boardState[row][col] = moveCount; updateBoard(); playSound(); checkWinCondition(); }
    const getValidMoves = (r, c) => [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].map(m=>({row:r+m[0],col:c+m[1]})).filter(m=>m.row>=0&&m.row<rows&&m.col>=0&&m.col<cols&&boardState[m.row][m.col]===0);
    function updateBoard() { document.querySelectorAll('.square').forEach(s => { const r = parseInt(s.dataset.row), c = parseInt(s.dataset.col); s.innerHTML = ''; s.classList.remove('knight','visited','highlight'); if (boardState[r][c] > 0) { s.classList.add('visited'); s.textContent = boardState[r][c]; if (r === knightPosition.row && c === knightPosition.col) { s.classList.add('knight'); s.innerHTML = '♞'; } } }); if (gameOver) return; const moves = getValidMoves(knightPosition.row, knightPosition.col); moves.forEach(m => document.querySelector(`.square[data-row='${m.row}'][data-col='${m.col}']`).classList.add('highlight')); if (moves.length > 0) { messageElement.textContent = `이동 횟수: ${moveCount}`; } else if (moveCount < totalSquares) { messageElement.textContent = '실패! 더 이상 이동할 수 없습니다.'; gameOver = true; stopTimer(); } }

    function checkWinCondition() {
        if (moveCount === totalSquares) {
            gameOver = true;
            stopTimer();
            messageElement.textContent = ``;
            winModalSizeSpan.textContent = `${rows}x${cols}`;
            winModalTimeSpan.textContent = formatTime(clearTime);
            nicknameEntryView.classList.remove('hidden');
            rankResultView.classList.add('hidden');
            nicknameInput.value = '';
            openWinModal();
            document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
        }
    }
    
    function resetToSetup() { gameSetup.classList.remove('hidden'); gameBoardContainer.classList.add('hidden'); resetTimer(); }

    // --- 사이즈 선택 및 게임 시작 로직 ---
    function populateSizeOptions() {
        sizeOptionsContainer.innerHTML = '';
        const groupedSizes = boardSizes.reduce((acc, size) => { const prefix = size.split('x')[0]; if (!acc[prefix]) acc[prefix] = []; acc[prefix].push(size); return acc; }, {});
        for (const prefix in groupedSizes) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'size-group';
            const label = document.createElement('span');
            label.className = 'size-group-label';
            label.textContent = `${prefix}x`;
            groupDiv.appendChild(label);
            groupedSizes[prefix].forEach(size => {
                const button = document.createElement('button');
                button.className = 'size-option-button';
                button.textContent = size;
                button.addEventListener('click', () => handleSizeSelection(size, button));
                groupDiv.appendChild(button);
            });
            sizeOptionsContainer.appendChild(groupDiv);
        }
    }
    
    function handleSizeSelection(size, button) {
        document.querySelectorAll('.size-option-button.selected').forEach(b => b.classList.remove('selected'));
        button.classList.add('selected');
        selectedSize = size;
        rankingBoardSizeSpan.textContent = size;
        fetchAndDisplayRankings(size);
        startSelectedGameButton.classList.remove('hidden');
    }
    
    // --- 초기화 및 이벤트 리스너 설정 ---
    function initialize() {
        themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light'));
        soundToggle.addEventListener('click', () => applySoundSetting(!isSoundOn));
        
        // [수정] '게임 시작하기' 버튼 클릭 시 모달 열기와 함께 오디오 컨텍스트 잠금 해제
        showModalButton.addEventListener('click', () => {
            unlockAudioContext();
            openSizeModal();
        });
        
        modalCloseButton.addEventListener('click', closeSizeModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeSizeModal());
        winModalOverlay.addEventListener('click', (e) => e.target === winModalOverlay && closeWinModal());
        startSelectedGameButton.addEventListener('click', () => { closeSizeModal(); initGame(); });
        submitRankButton.addEventListener('click', submitRanking);
        restartSameSizeButton.addEventListener('click', restartCurrentGame);
        chooseNewSizeButton.addEventListener('click', resetToSetup);
        winModalRestartSameButton.addEventListener('click', () => { closeWinModal(); restartCurrentGame(); });
        winModalChooseNewButton.addEventListener('click', () => { closeWinModal(); resetToSetup(); });

        applyTheme(localStorage.getItem('theme') || 'dark');
        applySoundSetting(localStorage.getItem('soundOn') !== 'false');
        populateSizeOptions();
    }

    initialize();
});
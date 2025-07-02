// server.js

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// 클라이언트로부터 오는 JSON 요청을 파싱하기 위한 미들웨어
app.use(express.json());

// [추가] 디버깅을 위한 요청 로깅 미들웨어
// 모든 요청이 들어올 때마다 서버 콘솔에 로그를 남깁니다.
// 예: "GET /", "GET /style.css", "GET /sounds/move-sound.mp3"
app.use((req, res, next) => {
    console.log(`요청 수신: ${req.method} ${req.url}`);
    next(); // 다음 미들웨어나 라우트 핸들러로 제어를 넘깁니다.
});

// 'public' 디렉토리를 정적 파일 제공 폴더로 설정
// 이 코드는 public 폴더를 웹 루트(/)로 만듭니다.
// 즉, 브라우저에서 /style.css를 요청하면 서버는 실제 [프로젝트폴더]/public/style.css 파일을 찾습니다.
app.use(express.static(path.join(__dirname, 'public')));

// 랭킹 데이터를 서버 메모리에 저장
const rankings = {};

// 특정 사이즈의 랭킹을 가져오는 API
app.get('/api/rankings/:size', (req, res) => {
    const { size } = req.params;
    const sizeRankings = rankings[size] || [];
    sizeRankings.sort((a, b) => a.time - b.time);
    res.json(sizeRankings.slice(0, 10));
});

// 새로운 랭킹 기록을 저장하는 API
app.post('/api/rankings', (req, res) => {
    const { name, size, time } = req.body;
    if (!name || !size || typeof time !== 'number') {
        return res.status(400).json({ success: false, message: '잘못된 데이터입니다.' });
    }
    if (!rankings[size]) {
        rankings[size] = [];
    }
    const newRecord = { name, time };
    rankings[size].push(newRecord);
    rankings[size].sort((a, b) => a.time - b.time);
    const rank = rankings[size].findIndex(record => record.name === name && record.time === time) + 1;
    console.log(`새로운 랭킹 등록: ${size} 보드, ${name}, ${time}ms, ${rank}위`);
    res.status(201).json({ 
        success: true, 
        rank: rank,
        newRankings: rankings[size].slice(0, 10)
    });
});

// 루트 URL('/')로 GET 요청이 오면 index.html 파일 전송
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  // 서버가 살아있다는 의미로 상태 코드 200과 함께 'OK' 텍스트를 응답합니다.
  res.status(200).send('OK');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
// server.js

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
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
    
    // [수정] 클라이언트에 순위와 함께 업데이트된 전체 랭킹 목록을 반환
    res.status(201).json({ 
        success: true, 
        rank: rank,
        newRankings: rankings[size].slice(0, 10) // 상위 10개 랭킹 반환
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
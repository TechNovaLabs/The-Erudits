import { database, ref, set, onValue, get } from './firebase.js';
import { questionsData } from './questions.js';

let currentQuestionIndex = 0;
let currentBlockNumber = 0; 
let userScoreInBlock = 0;   
let totalGameScore = 0;     
let timerInterval = null;
let timeLeft = 20;
let shuffledQuestions = []; 

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function initGameLogic(roomId, isAdmin, myNickname) {
    const btnStartGame = document.getElementById('btn-start-game');
    
    if (isAdmin) {
        btnStartGame.classList.remove('hidden');
        btnStartGame.onclick = async () => {
            await set(ref(database, `rooms/${roomId}/votes`), null);
            set(ref(database, `rooms/${roomId}/info/gameState`), "choosing_category");
        };
    }

    onValue(ref(database, `rooms/${roomId}/info/gameState`), (snapshot) => {
        const state = snapshot.val();
        if (state === "choosing_category") {
            renderCategoryVoting(roomId, myNickname, isAdmin);
        } else if (state === "playing") {
            syncAndStartBlock(roomId, myNickname, isAdmin);
        } else if (state === "finished") {
            handleGameEnd(roomId, myNickname);
        }
    });

    if (isAdmin) {
        onValue(ref(database, `rooms/${roomId}/votes/category`), (snapshot) => {
            checkVotes(roomId, snapshot.val());
        });
    }
}

function showModal(title, message, btnText = "Ок", callback = null) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').innerHTML = message;
    const btn = document.getElementById('modal-btn');
    btn.textContent = btnText;
    modal.classList.remove('hidden');
    btn.onclick = () => {
        modal.classList.add('hidden');
        if (callback) callback();
    };
}

async function renderCategoryVoting(roomId, myNickname, isAdmin) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('voting-screen').classList.remove('hidden');
    document.getElementById('vote-status').classList.add('hidden');

    const grid = document.getElementById('categories-grid');
    grid.innerHTML = "";
    grid.classList.remove('hidden');

    Object.keys(questionsData).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = "category-card";
        btn.textContent = cat;
        btn.onclick = async () => {
            grid.classList.add('hidden');
            document.getElementById('vote-status').classList.remove('hidden');
            await set(ref(database, `rooms/${roomId}/votes/category/${myNickname}`), cat);
        };
        grid.appendChild(btn);
    });
}

async function checkVotes(roomId, votes) {
    if (!votes) return;
    const snap = await get(ref(database, `rooms/${roomId}`));
    const data = snap.val();
    if (data.info.gameState !== "choosing_category") return;

    const playersCount = Object.keys(data.players).length;
    const votesCount = Object.keys(votes).length;

    if (votesCount >= playersCount) {
        const counts = {};
        // 1. Считаем голоса
        Object.values(votes).forEach(v => counts[v] = (counts[v] || 0) + 1);
        
        // 2. Находим максимальное кол-во голосов
        const maxVotes = Math.max(...Object.values(counts));
        
        // 3. Находим все категории, набравшие максимум (для обработки ничьей)
        const winners = Object.keys(counts).filter(cat => counts[cat] === maxVotes);
        
        // 4. Случайный выбор из лидеров, если их несколько
        const finalWinner = winners[Math.floor(Math.random() * winners.length)];

        await set(ref(database, `rooms/${roomId}/votes/category`), null);
        await set(ref(database, `rooms/${roomId}/info/selectedCategory`), finalWinner);
        await set(ref(database, `rooms/${roomId}/info/gameState`), "playing");
    }
}

async function syncAndStartBlock(roomId, myNickname, isAdmin) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('game-screen').classList.remove('hidden');
    
    const snapshot = await get(ref(database, `rooms/${roomId}/info/selectedCategory`));
    const category = snapshot.val();

    if (isAdmin) {
        const allIndexes = Array.from(Array(questionsData[category].length).keys());
        const chosenIndexes = shuffle(allIndexes).slice(0, 30);
        await set(ref(database, `rooms/${roomId}/info/currentQuestionIndexes`), chosenIndexes);
    }

    onValue(ref(database, `rooms/${roomId}/info/currentQuestionIndexes`), (snap) => {
        const indexes = snap.val();
        if (indexes) {
            shuffledQuestions = indexes.map(idx => questionsData[category][idx]);
            currentQuestionIndex = 0;
            userScoreInBlock = 0;
            currentBlockNumber++; 
            document.getElementById('category-name-display').textContent = `${category} (Блок ${currentBlockNumber})`;
            loadQuestion(category, roomId, myNickname);
        }
    }, { onlyOnce: true });
}

function loadQuestion(category, roomId, myNickname) {
    clearInterval(timerInterval);
    if (currentQuestionIndex >= shuffledQuestions.length) {
        finishBlock(roomId, myNickname);
        return;
    }

    const qData = shuffledQuestions[currentQuestionIndex];
    document.getElementById('question-text').textContent = qData.q;
    document.getElementById('question-counter').textContent = `Вопрос ${currentQuestionIndex + 1}/${shuffledQuestions.length}`;
    
    const grid = document.getElementById('answers-grid');
    grid.innerHTML = "";

    const answers = qData.a.map((text, index) => ({
        text: text,
        isCorrect: index === qData.cor
    }));
    shuffle(answers);

    answers.forEach((ans) => {
        const btn = document.createElement('button');
        btn.textContent = ans.text;
        btn.onclick = () => {
            clearInterval(timerInterval);
            if (ans.isCorrect) {
                totalGameScore += 10;
                userScoreInBlock += 10;
                document.getElementById('my-score-val').textContent = totalGameScore;
            }
            const allBtns = grid.querySelectorAll('button');
            allBtns.forEach((b, idx) => {
                b.disabled = true;
                if (answers[idx].isCorrect) b.style.background = "var(--success)";
            });
            if (!ans.isCorrect) btn.style.background = "var(--error)";
            setTimeout(() => {
                currentQuestionIndex++;
                loadQuestion(category, roomId, myNickname);
            }, 1500);
        };
        grid.appendChild(btn);
    });
    startTimer(category, roomId, myNickname);
}

function startTimer(category, roomId, myNickname) {
    timeLeft = 20;
    document.getElementById('timer-circle').textContent = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-circle').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            currentQuestionIndex++;
            loadQuestion(category, roomId, myNickname);
        }
    }, 1000);
}

async function finishBlock(roomId, myNickname) {
    const roomSnap = await get(ref(database, `rooms/${roomId}`));
    const roomData = roomSnap.val();
    const blocksToWin = parseInt(roomData.info.blocksToWin) || 1;
    
    let myKey = "";
    for (let key in roomData.players) {
        if (roomData.players[key].name === myNickname) myKey = key;
    }
    await set(ref(database, `rooms/${roomId}/players/${myKey}/score`), totalGameScore);

    const isAdmin = roomData.players[myKey].role === "admin";

    if (currentBlockNumber >= blocksToWin) {
        showModal("Все блоки пройдены!", `Ваш финальный счет: ${totalGameScore}. Ожидаем подведения итогов...`, "Ждать");
        if (isAdmin) {
            setTimeout(() => {
                set(ref(database, `rooms/${roomId}/info/gameState`), "finished");
            }, 4000);
        }
    } else {
        showModal("Раунд окончен", `Счет за блок: ${userScoreInBlock}<br>Всего: ${totalGameScore}`, "Следующий блок", () => {
            if (isAdmin) {
                set(ref(database, `rooms/${roomId}/info/gameState`), "choosing_category");
            }
        });
    }
}

async function handleGameEnd(roomId, myNickname) {
    clearInterval(timerInterval);
    const roomSnap = await get(ref(database, `rooms/${roomId}`));
    const players = roomSnap.val().players;
    
    let maxScore = -1;
    let winners = [];

    for (let p in players) {
        if (players[p].score > maxScore) {
            maxScore = players[p].score;
        }
    }

    for (let p in players) {
        if (players[p].score === maxScore) {
            winners.push(players[p].name);
        }
    }

    let title = "";
    let message = "";

    if (winners.length > 1) {
        title = "🤝 НИЧЬЯ!";
        message = `Сразу несколько эрудитов набрали по <b>${maxScore}</b> очков:<br>
                   <span style="color: var(--accent)">${winners.join(", ")}</span>`;
    } else {
        const winnerName = winners[0];
        title = (winnerName === myNickname) ? "🏆 ПОБЕДА!" : "ИГРА ОКОНЧЕНА";
        message = (winnerName === myNickname) 
            ? `Поздравляем! Вы обошли всех с результатом <b>${totalGameScore}</b>!` 
            : `Победитель: <b>${winnerName}</b> (${maxScore} б.)<br>Ваш результат: ${totalGameScore}`;
    }

    showModal(title, message, "В главное меню", () => {
        location.reload();
    });
}
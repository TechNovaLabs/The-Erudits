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
        Object.values(votes).forEach(v => counts[v] = (counts[v] || 0) + 1);
        const maxVotes = Math.max(...Object.values(counts));
        const winners = Object.keys(counts).filter(cat => counts[cat] === maxVotes);
        const finalWinner = winners[Math.floor(Math.random() * winners.length)];

        await set(ref(database, `rooms/${roomId}/votes/category`), null);
        await set(ref(database, `rooms/${roomId}/info/currentQuestionIndexes`), null); // Очищаем старые индексы
        await set(ref(database, `rooms/${roomId}/info/selectedCategory`), finalWinner);
        await set(ref(database, `rooms/${roomId}/info/gameState`), "playing");
    }
}

async function syncAndStartBlock(roomId, myNickname, isAdmin) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('question-text').textContent = "Загрузка вопросов...";
    
    const snapshot = await get(ref(database, `rooms/${roomId}/info/selectedCategory`));
    const category = snapshot.val();

    if (isAdmin) {
        const allIndexes = Array.from(Array(questionsData[category].length).keys());
        const chosenIndexes = shuffle(allIndexes).slice(0, 30);
        
        const roomSnap = await get(ref(database, `rooms/${roomId}/players`));
        const players = roomSnap.val();
        for(let key in players) {
            await set(ref(database, `rooms/${roomId}/players/${key}/finished`), false);
        }

        await set(ref(database, `rooms/${roomId}/info/currentQuestionIndexes`), chosenIndexes);
    }

    // Слушаем индексы. Как только они появятся в базе — начинаем игру
    const indexesRef = ref(database, `rooms/${roomId}/info/currentQuestionIndexes`);
    onValue(indexesRef, (snap) => {
        const indexes = snap.val();
        if (indexes && indexes.length > 0) {
            shuffledQuestions = indexes.map(idx => questionsData[category][idx]);
            currentQuestionIndex = 0;
            userScoreInBlock = 0;
            currentBlockNumber++; 
            document.getElementById('category-name-display').textContent = `${category}`;
            document.getElementById('current-block-val').textContent = currentBlockNumber;
            loadQuestion(category, roomId, myNickname);
        }
    }, { onlyOnce: true });
}

function loadQuestion(category, roomId, myNickname) {
    clearInterval(timerInterval);
    const grid = document.getElementById('answers-grid');
    grid.innerHTML = "";

    if (currentQuestionIndex >= shuffledQuestions.length) {
        finishBlock(roomId, myNickname);
        return;
    }

    const qData = shuffledQuestions[currentQuestionIndex];
    document.getElementById('question-text').textContent = qData.q;
    document.getElementById('question-counter').textContent = `Вопрос ${currentQuestionIndex + 1}/${shuffledQuestions.length}`;
    
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
                if (answers[idx].isCorrect) {
                    b.style.background = "var(--success)";
                    b.style.color = "white";
                }
            });
            if (!ans.isCorrect) {
                btn.style.background = "var(--error)";
                btn.style.color = "white";
            }
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
    await set(ref(database, `rooms/${roomId}/players/${myKey}/finished`), true);

    const isAdmin = roomData.players[myKey].role === "admin";

    if (currentBlockNumber >= blocksToWin) {
        showModal("Вы закончили!", `Ваш счет: ${totalGameScore}. Ожидаем завершения остальных игроков...`, "Ждать");
        
        if (isAdmin) {
            onValue(ref(database, `rooms/${roomId}/players`), (snapshot) => {
                const players = snapshot.val();
                if (!players) return;
                const allFinished = Object.values(players).every(p => p.finished === true);
                if (allFinished) {
                    set(ref(database, `rooms/${roomId}/info/gameState`), "finished");
                }
            });
        }
    } else {
        showModal("Раунд окончен", `Счет: ${userScoreInBlock}`, "Ожидание", () => {
            if (isAdmin) {
                onValue(ref(database, `rooms/${roomId}/players`), (snapshot) => {
                    const players = snapshot.val();
                    const allFinished = Object.values(players).every(p => p.finished === true);
                    if (allFinished) {
                        set(ref(database, `rooms/${roomId}/info/gameState`), "choosing_category");
                    }
                }, {onlyOnce: true});
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
        const s = players[p].score || 0;
        if (s > maxScore) maxScore = s;
    }

    for (let p in players) {
        if ((players[p].score || 0) === maxScore) {
            winners.push(players[p].name);
        }
    }

    let title = winners.length > 1 ? "🤝 НИЧЬЯ!" : (winners[0] === myNickname ? "🏆 ПОБЕДА!" : "ИГРА ОКОНЧЕНА");
    let message = winners.length > 1 
        ? `Лидеры (по ${maxScore} очков): <br><span style="color:var(--accent)">${winners.join(", ")}</span>`
        : `Победитель: <b>${winners[0]}</b> (${maxScore} очков). <br>Ваш результат: ${totalGameScore}`;

    showModal(title, message, "В главное меню", () => {
        location.reload();
    });
}
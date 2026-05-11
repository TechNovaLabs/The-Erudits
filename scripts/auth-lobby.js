import { database, ref, set, get, onValue } from './firebase.js';

export function setupAuthLobby(callbacks) {
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const btnStartLobby = document.getElementById('btn-start-lobby');
    const joinInput = document.getElementById('join-id-input');

    // Модальное окно для ввода ника при присоединении
    const nickModal = document.getElementById('nickname-modal');
    const nickInput = document.getElementById('modal-nickname-input');
    const confirmBtn = document.getElementById('modal-nickname-confirm');
    const cancelBtn = document.getElementById('modal-nickname-cancel');

    // Создание комнаты
    btnCreate.addEventListener('click', () => callbacks.onNavigate('settings'));

    // Открытие лобби (Админ создает комнату)
    btnStartLobby.addEventListener('click', async () => {
        const nickname = document.getElementById('user-nickname').value.trim();
        const roomName = document.getElementById('room-name').value.trim();
        const maxPlayers = document.getElementById('players-count').value;

        if (!nickname || !roomName) return alert("Заполните поля!");

        const roomId = Math.floor(10000000 + Math.random() * 90000000);
        const roomRef = ref(database, 'rooms/' + roomId);

        const roomData = {
            info: { 
                name: roomName, 
                maxPlayers: parseInt(maxPlayers), 
                status: "waiting", 
                gameState: "lobby" 
            },
            players: { 
                // Используем уникальный ключ для админа
                ["admin_" + Date.now()]: { name: nickname, score: 0, role: "admin" } 
            }
        };

        await set(roomRef, roomData);
        callbacks.onRoomJoined(roomId, nickname, true);
    });

    // Присоединение (Игрок вводит ID)
    btnJoin.addEventListener('click', () => {
        const roomId = joinInput.value.trim();
        if (!roomId || roomId.length < 8) return alert("Введите корректный ID комнаты!");
        
        nickModal.classList.remove('hidden');

        cancelBtn.onclick = () => nickModal.classList.add('hidden');

        confirmBtn.onclick = async () => {
            const nickname = nickInput.value.trim();
            if (!nickname) return alert("Ник обязателен!");

            nickModal.classList.add('hidden');

            const roomRef = ref(database, 'rooms/' + roomId);
            const snapshot = await get(roomRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                const players = data.players || {};
                const pCount = Object.keys(players).length;
                
                // Проверка лимита игроков из настроек комнаты
                const maxAllowed = parseInt(data.info.maxPlayers) || 10;
                if (pCount >= maxAllowed) {
                    return alert(`Мест нет! Максимум игроков: ${maxAllowed}`);
                }

                // Генерируем УНИКАЛЬНЫЙ ключ, чтобы игроки не заменяли друг друга
                const playerKey = 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

                await set(ref(database, `rooms/${roomId}/players/${playerKey}`), {
                    name: nickname,
                    score: 0,
                    role: "player"
                });
                
                callbacks.onRoomJoined(roomId, nickname, false);
            } else {
                alert("Комната не найдена!");
            }
        };
    });
}

export function listenToPlayers(roomId, listElement) {
    onValue(ref(database, `rooms/${roomId}/players`), (snapshot) => {
        const players = snapshot.val();
        listElement.innerHTML = "";
        if (!players) return;

        for (let id in players) {
            const li = document.createElement('li');
            li.className = "player-item";
            li.innerHTML = `
                <span class="player-icon">${players[id].role === 'admin' ? '👑' : '👤'}</span>
                <span class="player-name">${players[id].name}</span>
            `;
            listElement.appendChild(li);
        }
    });
}
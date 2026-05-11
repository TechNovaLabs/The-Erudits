import { database, ref, set, get, onValue } from './firebase.js';

export function setupAuthLobby(callbacks) {
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const btnStartLobby = document.getElementById('btn-start-lobby');
    const joinInput = document.getElementById('join-id-input');

    // Создание комнаты
    btnCreate.addEventListener('click', () => callbacks.onNavigate('settings'));

    // Открытие лобби (Админ)
    btnStartLobby.addEventListener('click', async () => {
        const nickname = document.getElementById('user-nickname').value.trim();
        const roomName = document.getElementById('room-name').value.trim();
        const maxPlayers = document.getElementById('players-count').value;

        if (!nickname || !roomName) return alert("Заполните поля!");

        const roomId = Math.floor(10000000 + Math.random() * 90000000);
        const roomRef = ref(database, 'rooms/' + roomId);

        const roomData = {
            info: { name: roomName, maxPlayers: parseInt(maxPlayers), status: "waiting", gameState: "lobby" },
            players: { "player1": { name: nickname, score: 0, role: "admin" } }
        };

        await set(roomRef, roomData);
        callbacks.onRoomJoined(roomId, nickname, true);
    });

    // Присоединение (Игрок)
    // Присоединение (Игрок)
    btnJoin.addEventListener('click', () => {
        const roomId = joinInput.value.trim();
        if (!roomId) return alert("Введите ID!");

        // Вместо prompt показываем модалку
        const nickModal = document.getElementById('nickname-modal');
        const nickInput = document.getElementById('modal-nickname-input');
        const confirmBtn = document.getElementById('modal-nickname-confirm');
        const cancelBtn = document.getElementById('modal-nickname-cancel');

        nickModal.classList.remove('hidden');
        nickInput.focus();

        // Обработка отмены
        cancelBtn.onclick = () => nickModal.classList.add('hidden');

        // Обработка подтверждения
        confirmBtn.onclick = async () => {
            const nickname = nickInput.value.trim();
            if (!nickname) return alert("Ник обязателен!");

            nickModal.classList.add('hidden'); // Закрываем

            const roomRef = ref(database, 'rooms/' + roomId);
            const snapshot = await get(roomRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                const pCount = Object.keys(data.players || {}).length;
                if (pCount >= (data.info.maxPlayers || 10)) return alert("Мест нет!");

                await set(ref(database, `rooms/${roomId}/players/player${pCount + 1}`), {
                    name: nickname, score: 0, role: "player"
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
        for (let id in players) {
            const li = document.createElement('li');
            li.textContent = `👤 ${players[id].name} ${players[id].role === 'admin' ? '(Глава)' : ''}`;
            listElement.appendChild(li);
        }
    });
}
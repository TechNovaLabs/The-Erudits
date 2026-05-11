import { setupAuthLobby, listenToPlayers } from './auth-lobby.js';
import { initGameLogic } from './game-logic.js';

const screens = {
    welcome: document.getElementById('welcome-screen'),
    settings: document.getElementById('settings-screen'),
    lobby: document.getElementById('lobby-screen')
};

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

// Запуск инициализации лобби
setupAuthLobby({
    onNavigate: (screen) => showScreen(screen),
    onRoomJoined: (roomId, nickname, isAdmin) => {
        showScreen('lobby');
        document.getElementById('lobby-id-display').textContent = roomId;

        listenToPlayers(roomId, document.getElementById('players-list'));
        // Добавляем nickname в параметры:
        initGameLogic(roomId, isAdmin, nickname);
    }
});
/**
 * Файл конфигурации и инициализации Firebase
 * Здесь настраивается связь с облачной базой данных
 */

// 1. Импортируем функции из библиотек Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 2. Твой личный конфиг (ключи)
const firebaseConfig = {
  apiKey: "AIzaSyAkB5cfvyOeQXsGnUJk63jbEKZSVj8RqIw",
  authDomain: "the-erudits.firebaseapp.com",
  projectId: "the-erudits",
  storageBucket: "the-erudits.firebasestorage.app",
  messagingSenderId: "441296539327",
  appId: "1:441296539327:web:3a00823ca92ffd7be1c00a",
  // Твоя ссылка на базу (обрати внимание на регион europe-west1)
  databaseURL: "https://the-erudits-default-rtdb.europe-west1.firebasedatabase.app/"
};

// 3. Запускаем приложение Firebase
const app = initializeApp(firebaseConfig);

// 4. Получаем доступ к базе данных
const database = getDatabase(app);

// 5. Делаем объекты доступными для других файлов
export { database, ref, set, get, child, update, onValue };
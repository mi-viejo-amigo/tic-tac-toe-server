import express from 'express';
import http from 'http';
import OpenAI from "openai";
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { calculateWinner, WINNING_COMBINATIONS } from './utils.js';
import { handleWinner, resetRoomState, sendRoomState } from './gameHandlers.js';
import { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom, isPlayerExist, createPlayer, logRooms } from './roomManager.js';


dotenv.config();

// Инициализируем OpenAI
const openai = new OpenAI({
  apiKey: process.env.API_KEY,
});

const handlePlayerLeave = (socket, io, roomName) => {
  

  removePlayerFromRoom(roomName, socket.id);

  const roomData = getRoom(roomName);
  if (!roomData) return;

  if (roomData) {
    roomData.state.squares = Array(9).fill(null); // Сброс поля
    io.to(roomName).emit('updatePlayers', roomData.players);
    io.to(roomName).emit('gameRestarted', {
        currentPlayer: 'X',
        newSquares: roomData.state.squares,
        players: roomData.players,
    });
  }
  socket.leave(roomName);
};

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions)); // Применяем CORS к приложению

const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    socket.on('joinRoom', ({ name, room, gameMode }) => {

        createRoom(room, gameMode);
        const roomData = getRoom(room);

        if (roomData.gameMode !== gameMode) {
            socket.emit('error', { message: `Выберете режим: ${roomData.gameMode} что бы присоединиться` });
            return;
        }

        if (roomData.players.length >= 2) {
            socket.emit('error', { message: 'Комната уже заполнена. Выберите другую комнату.' });
            return;
        }
        socket.room = room;
        socket.emit('allowed');
        
        socket.on('readyForRole', ({ name, room }) => {
            const roomData = getRoom(room);
            
            if (isPlayerExist(room, name, socket.id)) return

            const player = createPlayer(socket.id, name, roomData.players, roomData.gameMode);

            // логируем юзера, что бы посмотреть скиллы.
            console.log(player)
            console.log(`${name} вошел в комнату ${room}, со скилами: ${JSON.stringify(player.skills || {})}`);
            // 
            addPlayerToRoom(room, player);

            socket.join(room);
            socket.emit('playerRole', { role: player.role, skills: player.skills || {} });

            if (gameMode === 'AI_Standard' && roomData.players.length < 2) {
              // Бот
              const botName = 'OpenAI_Bot';
              const botRole = roomData.players[0].role === 'X' ? 'O' : 'X';
              roomData.players.push({ id: 'BOT_ID', name: botName, role: botRole });
              console.log(`[${room}] AI bot joined as ${botRole}.`);
            }


            io.to(room).emit('updatePlayers', roomData.players);
        })


        socket.on('lock', ({ room, index, player, lockAction}) => {
          const roomData = getRoom(room);
          
          if (roomData.gameMode === 'Half') {
            if (lockAction === 'lock') {
              roomData.state.locks[index] = 7; // Блокируем клетку на 7 хода
              io.to(room).emit('locksUpdated', roomData.state.locks);
              return;
            } else if (lockAction === 'unlock') {
              delete roomData.state.locks[index]; // Удаляем блок, если он больше не нужен
              io.to(room).emit('locksUpdated', roomData.state.locks);
              return;
            }
          }
        })

        socket.on('move', async ({ room, index, marker, player }) => {
          const roomData = getRoom(room);

          roomData.history.push(index);

          if (player !== roomData.state.currentPlayer) {
            console.log('Неправильный ход.');
            return;
          }

          if (Object.keys(roomData.state.locks).length > 0) {
            Object.keys(roomData.state.locks).forEach((lockedIndex) => {
              const currentLock = roomData.state.locks[lockedIndex];
              if (currentLock > 1) {
                roomData.state.locks[lockedIndex] -= 1;
              } else {
                delete roomData.state.locks[lockedIndex]; // Удаляем блок, если он больше не нужен
              }
            });
            io.to(room).emit('locksUpdated', roomData.state.locks);
          }

          // Обновляем состояние клетки
          roomData.state.squares[index] = marker;
          roomData.state.currentPlayer = player === 'X' ? 'O' : 'X';
        
          // Проверяем победу
          const gameResult = calculateWinner(roomData.state.squares, roomData.gameMode);
          handleWinner(io, room, roomData, gameResult);

          if (roomData.gameMode === 'AI_Standard' && !gameResult) {
            // Ищем бота, чей role == roomData.state.currentPlayer
            const botPlayer = roomData.players.find(
              (p) => p.id === 'BOT_ID' && p.role === roomData.state.currentPlayer
            );
            if (botPlayer) {
              // Вызываем ход бота
              await handleAiMove(io, room, roomData, botPlayer.role);
            }
          }

        });
        
        socket.on('restartGame', ({ room, saveScores = false, updateSkills = false }) => {
          const roomData = getRoom(room);
          resetRoomState(roomData, saveScores, updateSkills);
          sendRoomState(io, room, roomData, updateSkills, { winCombination: null, winner: null });
        });

        socket.on('disconnect', () => {
          // Логирование отпечатка комнаты во время выхода игрока
          logRooms()
          ////
          handlePlayerLeave(socket, io, room);
        });
    });
  });
  

  const PORT = process.env.PORT || 8080;

  server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });

  // ------------------ AI LOGIC ------------------

// Вызываем, когда ход бота
export async function handleAiMove(io, room, roomData, role) {
  const squares = roomData.state.squares;

  // Попросим OpenAI выбрать индекс
  let aiIndex = await getAiIndexFromOpenAI(squares, role, roomData);
  console.log('AI index:', aiIndex);
  // Если индекс некорректный или клетка занята, ставим в первую свободную
  if (
    aiIndex < 0 ||
    aiIndex > 8 ||
    squares[aiIndex] !== null
  ) {
    aiIndex = squares.findIndex((cell) => cell === null);
    if (aiIndex === -1) {
      return; // нет свободных клеток
    }
  }

  roomData.history.push(aiIndex)
  // Ставим ход бота
  squares[aiIndex] = role;
  // Меняем ход на противника
  roomData.state.currentPlayer = (role === 'X') ? 'O' : 'X';

  // Проверяем победу
  const gameResult = calculateWinner(squares, roomData.gameMode);
  // Используем существующий обработчик handleWinner
  handleWinner(io, room, roomData, gameResult);

}

// Запрос к OpenAI, возвращает индекс (0..8) или -1 при ошибке
async function getAiIndexFromOpenAI(squares, role, roomData) {
  try {
    // Инициируем массив истории, если не существует
    if (!roomData.aiMessages) {
      roomData.aiMessages = [];
    }

    const opponent = (role === 'X') ? 'O' : 'X';
    const boardArray = squares.map((v, i) => v ? v : 'null')
    console.log('AI board:', boardArray)

    const systemPrompt = `
      Ты играеш в tic-tac-toe. Задача — принимать текущее состояние доски и делать оптимальный ход. Ты играешь за "${role}", а противник за "${opponent}".
      Просто делай ход учитыва что "${role}" в полученном от юзера массиве это твои позиции, "${opponent}"- позиции соперника, а "null" пустое поле куда можно сходить.
      Ответ верни числом в формате: "Индекс: N". где N - выбранный индекс поля массива Доски. 
    `.trim();

  
    // ---------- USER PROMPT (текущая доска) -----------
    // Показываем текущее состояние, просим вернуть индекс. Коротко повторяем роль.
    const userPrompt = `
      Твой ход!
      Текущая доска: board = ${JSON.stringify(boardArray)}, 
      Ты (бот) ${role}, соперник ${opponent}.
      верни числом в формате: "Индекс: N"
      `.trim();

    console.log(userPrompt)
    // Собираем полный массив сообщений. В самом начале systemPrompt,
    // затем все старые сообщения roomData.aiMessages,
    // и в конце новое user-сообщение.
    const conversation = [
      {
        role: 'system',
        content: systemPrompt
      },
      // ... история (пары user/assistant), если она есть
      ...roomData.aiMessages,
      {
        role: 'user',
        content: userPrompt
      }
    ];

    

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversation,
    });

    const text = completion.choices[0].message?.content?.trim() || '';
    console.log('completion:', completion);
    console.log('text:', text);
    // Сохраняем ответ в истории (assistant)
    roomData.aiMessages.push({
      role: 'assistant',
      content: text
    });
    
    const match = text.match(/Индекс:\s*(\d+)/i);
    if (match) {
      const parsedIndex = parseInt(match[1], 10);
 
      if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex <= 8) {
        return parsedIndex;
      }
    }
    
    if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex <= 8) {
      return parsedIndex;
    }
  } catch (err) {
    console.error('OpenAI error:', err);
  }
  return -1;
}
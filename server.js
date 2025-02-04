import express from 'express';
import http from 'http';
import OpenAI from "openai";
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { calculateWinner, formatMovesHistory, findStrategicMove, getTopMoves } from './utils.js';
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


          if (player !== roomData.state.currentPlayer) {
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
              await handleAiMove(io, room, roomData, botPlayer.role, index);
            }
          }

        });
        
        socket.on('restartGame', ({ room, saveScores = false, updateSkills = false }) => {
          const roomData = getRoom(room);
          resetRoomState(roomData, saveScores, updateSkills);
          sendRoomState(io, room, roomData, updateSkills, { winCombination: null, winner: null });
          if( roomData.gameMode === 'AI_Standard' ) {
            // Ищем бота
            const botPlayer = roomData.players.find((p) => p.id === 'BOT_ID');
            if (botPlayer.role === roomData.state.currentPlayer) {
              // Вызываем ход бота
              handleAiMove(io, room, roomData, botPlayer.role, null);
            }
          }
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
export async function handleAiMove(io, room, roomData, role, index) {
  const usersStep = index;
  const squares = roomData.state.squares;

  // Попросим OpenAI выбрать индекс
  let aiIndex = await getAiIndexFromOpenAI(squares, role, roomData, usersStep);
  
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
async function getAiIndexFromOpenAI(squares, role, roomData, usersStep) {
  try {
    // Инициируем массив истории, если не существует
    if (!roomData.aiMessages) {
      roomData.aiMessages = [];
    }
    if (!roomData.moves) {
      roomData.moves = [];
    }

    const opponent = (role === 'X') ? 'O' : 'X';
    // Преобразуем доску в строку (для компактности)
    const boardString = squares.map((v) => (v ? v : ".")).join("");

    // Добавляем ход в историю если юзер ходил
    if (usersStep) {
      roomData.moves.push({
        moveNumber: roomData.moves.length + 1, // Номер хода
        player: 'user',                       // Кто сделал ход ("user" или "bot")
        role: opponent,                           // Символ (X или O)
        position: usersStep,                   // Индекс на доске
      });
    }

    // ТЯЖОЛОЕ ВЫЧИСЛЕНИЕ , СЧИТАЕМ ВОЗМОЖНЫЕ СТРАТЕГИИ
    const {strategicMove, recommendedMoves, notRecommendedMoves} = findStrategicMove(squares, role);

    const movesHistory = formatMovesHistory(roomData.moves);

    // ---------- PROMPT ДЛЯ AI -----------
    let userPrompt = "";
    if (strategicMove) {
      userPrompt = `Y found strategic move for you, it is: ${strategicMove}, just return this value, no words`;
    } else {
      const { bestMoves, worstMoves } = getTopMoves(recommendedMoves, notRecommendedMoves);
      userPrompt = `
        The game continues.
        Moves history:
        ${movesHistory}

        **STRATEGY**
        1. **Best recommended moves for you to place:**
          ${squares[4] === null ? '- Ultimate good move: 4' : ''}
          - First best move: ${bestMoves[0] ?? "none"}
          - Second best move: ${bestMoves[1] ?? "none"}
        
        2. **Not recommended move (worst option):**
          - First Worst move: ${worstMoves[0] ?? "none"}
          - Second Worst move: ${worstMoves[1] ?? "none"}

        Your turn! Place ${role} on the board!
        ${usersStep ? `Last move by "User": ${opponent} played at position ${usersStep}.` : 'Your step is first.'}
        Current board state: "${boardString}" (use . for empty cells).
        
        Respond **only** with the index of the cell you want to play, no words.
      `.trim();
    }

    // Собираем полный массив сообщений. В самом начале systemPrompt,
    // затем все старые сообщения roomData.aiMessages,
    // и в конце новое user-сообщение.
    const conversation = [
      {
        role: "user",
        content:
          `You are an AI-bot playing with role "${role}" tic-tac-toe with against a 'user' as opponent plays as "${opponent}".
            Make the best move following optimal strategy to win him.
            **Rules for making a move:**
          1 **Strate moves**
           - If user says that he found strategic move for you, you can rely on it and return this value, no words.
          2 **STRATEGIC MOVES (ONLY IF NO THREAT OR WIN)**
           - If the center (Index: 4) is empty, place "${role}" there even if it is not so recommended.
           - Use the following recommended moves by User!
           - Try to not use any option from moves that User **NOT RECOMENDED**.
          `,
      },
      // ... история (если есть)
      // ...roomData.aiMessages,
      { role: "user", content: userPrompt },
    ];

    
      // Запрос к OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversation,
      });

    const text = completion.choices[0].message?.content?.trim() || '';


    // Сохраняем запрос пользователя и ответ бота в историю
    roomData.aiMessages.push({ role: 'user', content: userPrompt });
    roomData.aiMessages.push({ role: 'assistant', content: text });
    
    const match = text.match(/\d+/);
    if (match) {
      const parsedIndex = match ? parseInt(match[0], 10) : NaN;
 
      if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex <= 8) {
        // Записываем ход бота в историю
        roomData.moves.push({
          moveNumber: roomData.moves.length + 1, // Номер хода
          player: 'AI-bot',                        // Кто сделал ход
          role: role,                           // Символ (X или O)
          position: parsedIndex,                // Индекс на доске
        });

        return parsedIndex;
      }
    }
  } catch (err) {
    console.error('OpenAI error:', err);
  }
  return -1;
}

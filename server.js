import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { calculateWinner, definedRole } from './utils.js';
import { handleWinner, resetRoomState, sendRoomState } from './gameHandlers.js';
import { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom, logRooms } from './roomManager.js';

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
        // Присваиваем роль: первый игрок "X", второй "O"
        socket.on('readyForRole', ({ name, room }) => {
            const roomData = getRoom(room);
            // Проверка: если игрок уже есть в комнате, не добавляем его снова
            const isPlayerExist = roomData.players.some((player) => player.id === socket.id);
            if (isPlayerExist) {
                console.log(`Игрок ${name} уже зарегистрирован в комнате ${room}`);
                return;
            }

            // Добавляем игрока в комнату с его ролью
            const role = definedRole(roomData.players);
            const player = { id: socket.id, name, role, score: 0 };
            addPlayerToRoom(room, player);

            socket.join(room);
            console.log(`${name} вошел в комнату ${room} как ${role}`);

            // Сообщение о роли игрока
            socket.emit('playerRole', { role });
            // Обновление списка игроков для всех в комнате
            io.to(room).emit('updatePlayers', roomData.players);
        })
        
        socket.on('move', ({ room, index, marker, player }) => {
          const roomData = getRoom(room);
          // Обновляем состояние клетки
          roomData.state.squares[index] = marker;
          roomData.state.currentPlayer = player === 'X' ? 'O' : 'X';
        
          // Проверяем победу
          const gameResult = calculateWinner(roomData.state.squares, roomData.gameMode);
          handleWinner(io, room, roomData, gameResult);
        });
        
        socket.on('restartGame', ({ room, saveScores = false }) => {
          const roomData = getRoom(room);
          resetRoomState(roomData, saveScores);
          sendRoomState(io, room, roomData, { winCombination: null, winner: null });
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
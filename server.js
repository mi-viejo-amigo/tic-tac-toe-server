import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { calculateWinner } from './utils.js';
import { handleWinner, resetRoomState, sendRoomState } from './gameHandlers.js';
import { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom, isPlayerExist, createPlayer, logRooms } from './roomManager.js';

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
            console.log(`${name} вошел в комнату ${room}, со скилами: ${JSON.stringify(player.skills)}`);
            // 
            addPlayerToRoom(room, player);

            socket.join(room);
            socket.emit('playerRole', { role: player.role, skills: player.skills });
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

        socket.on('move', ({ room, index, marker, player }) => {
          const roomData = getRoom(room);
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
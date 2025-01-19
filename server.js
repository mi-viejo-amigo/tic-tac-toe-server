import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom } from './roomManager.js';

const handlePlayerLeave = (socket, io) => {
  const room = socket.room;
  if (!room) return;

  removePlayerFromRoom(room, socket.id);

  const roomData = getRoom(room);

  if (roomData) {
    io.to(room).emit('updatePlayers', roomData.players);
    io.to(room).emit('gemeRestarted', {
      currentPlayer: 'X',
      newSquares: Array(9).fill(null),
    });
  }
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
            console.log(`Комната ${room} имеет режим ${roomData.gameMode}`);
            socket.emit('error', { message: `Выберете режим: ${roomData.gameMode} что бы присоединиться` });
            return;
        }

        // Проверка на количество игроков
        if (roomData.players.length >= 2) {
            console.log(`Комната ${room} заполнена.`);
            socket.emit('error', { message: 'Комната уже заполнена. Выберите другую комнату.' });
            return;
        }
        socket.room = room;
        socket.emit('allowed', { gameMode: roomData.gameMode });
        // Присваиваем роль: первый игрок "X", второй "O"
        socket.on('readyForRole', ({ name, room }) => {

            // Проверка: если игрок уже есть в комнате, не добавляем его снова
            const isPlayerExist = roomData.players.some((player) => player.id === socket.id);
            if (isPlayerExist) {
                console.log(`Игрок ${name} уже зарегистрирован в комнате ${room}`);
                return;
            }
            // Добавляем игрока в комнату с его ролью
            const role = roomData.players.length === 0 ? 'X' : 'O';
            const player = { id: socket.id, name, role };
            addPlayerToRoom(room, player);

            socket.join(room);
            console.log(`${name} вошел в комнату ${room} как ${role}`);

            // Сообщение о роли игрока
            socket.emit('playerRole', { role });
            // Обновление списка игроков для всех в комнате
            io.to(room).emit('updatePlayers', roomData.players);
        })
        
        socket.on('move', ({ room, index, marker, player }) => {
            roomData.state.squares[index] = marker;
            roomData.state.currentPlayer = player === 'X' ? 'O' : 'X';

            io.to(room).emit('moveMade', {
              currentPlayer: roomData.state.currentPlayer,
              newSquares: roomData.state.squares
            });
        });

        socket.on('restartGame', ({room}) => {
            roomData.state.squares = Array(9).fill(null);
            roomData.state.currentPlayer = 'X';

            io.to(room).emit('gemeRestarted', {
              currentPlayer: roomData.state.currentPlayer,
              newSquares: roomData.state.squares
            });
        });

        socket.on('leaveRoom', () => handlePlayerLeave(socket, io));
        socket.on('disconnect', () => handlePlayerLeave(socket, io));
    });
  });
  

  const PORT = process.env.PORT || 8080;

  server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });
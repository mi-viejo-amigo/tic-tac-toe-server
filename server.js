import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { calculateWinner, definedRole } from './utils.js';
import { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom } from './roomManager.js';

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
        
          // Обновляем состояние клетки
          roomData.state.squares[index] = marker;
          roomData.state.currentPlayer = player === 'X' ? 'O' : 'X';
        
          // Проверяем победу
          const gameResult = calculateWinner(roomData.state.squares, roomData.gameMode);
          console.log(gameResult);
          let winnerPlayer = null

          if (gameResult && gameResult.winner) {
            if (gameResult.winner === 'Ничья') {
              io.to(room).emit('stateUpdated', {
                  players: roomData.players,
                  currentPlayer: roomData.state.currentPlayer,
                  squares: roomData.state.squares,
                  winCombination: null,
                  winner: 'Ничья',
              });
              return;
            } else {
              winnerPlayer = roomData.players.find((p) => p.role === gameResult.winner);
            }
            console.log(winnerPlayer);
            // Логика для режима Standard
            if (roomData.gameMode === 'Standard') {
              io.to(room).emit('stateUpdated', {
                players: roomData.players,
                currentPlayer: roomData.state.currentPlayer,
                squares: roomData.state.squares,
                winCombination: gameResult.combination,
                winner: winnerPlayer.name,
              });
              return; // Завершаем обработку для Standard
            }

            if (winnerPlayer && winnerPlayer.name !== 'Ничья') {
              winnerPlayer.score += 1;
        
              // Проверяем, достиг ли игрок победного количества очков
              if (winnerPlayer.score >= 3) {
                // Отправляем UI-состояние с ПОБЕДИТЕЛЕМ
                io.to(room).emit('stateUpdated', {
                  players: roomData.players,
                  currentPlayer: roomData.state.currentPlayer,
                  squares: roomData.state.squares,
                  winCombination: gameResult.combination,
                  winner: winnerPlayer.name,
                });
                return;
              }
        
              // Отправляем UI-состояние с выделенной выигрышной комбинацией
              io.to(room).emit('stateUpdated', {
                players: roomData.players,
                currentPlayer: roomData.state.currentPlayer,
                squares: roomData.state.squares,
                winCombination: gameResult.combination,
                winner: winnerPlayer.name,
              });
        
              // Задержка перед очисткой выигрышной комбинации
              setTimeout(() => {
                gameResult.combination.forEach((index) => {
                  roomData.state.squares[index] = null;
                });
        
                io.to(room).emit('stateUpdated', {
                  players: roomData.players,
                  currentPlayer: roomData.state.currentPlayer,
                  squares: roomData.state.squares,
                  winCombination: null, // Сброс выделения
                  winner: null,
                });
              }, 1000); // Задержка в 1 секунду
            } 
          } else {
            // Отправляем обновленное состояние всем игрокам
            io.to(room).emit('stateUpdated', {
              players: roomData.players,
              currentPlayer: roomData.state.currentPlayer,
              squares: roomData.state.squares,
              winCombination: null,
              winner: null,
            });
          }
        });
        
        socket.on('restartGame', ({ room, saveScores = false }) => {
        
          roomData.state.squares = Array(9).fill(null);
          roomData.state.currentPlayer = Math.random() > 0.5 ? 'X' : 'O';
          if (!saveScores) {
            roomData.players.forEach((player) => (player.score = 0));
          }
          io.to(room).emit('stateUpdated', {
            players: roomData.players,
            currentPlayer: roomData.state.currentPlayer,
            squares: roomData.state.squares,
            winCombination: null,
            winner: null,
          });
        });

        socket.on('disconnect', () => {
          handlePlayerLeave(socket, io, room);
        });
    });
  });
  

  const PORT = process.env.PORT || 8080;

  server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });
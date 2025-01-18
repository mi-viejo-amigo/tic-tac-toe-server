import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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

let rooms = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
  
    socket.on('joinRoom', ({ name, room }) => {
        if (!rooms[room]) {
            rooms[room] = [];
        }
        
        // Проверка на количество игроков
        if (rooms[room].length >= 2) {
            console.log(`Комната ${room} заполнена.`);
            socket.emit('roomFull', { message: 'Комната уже заполнена. Выберите другую комнату.' });
            return;
        }
        socket.room = room;
        socket.emit('allowed');
        // Присваиваем роль: первый игрок "X", второй "O"
        socket.on('readyForRole', ({ name, room }) => {
            const role = rooms[room].length === 0 ? 'X' : 'O';
            // Добавляем игрока в комнату с его ролью
            const player = { id: socket.id, name, role };
            rooms[room].push(player);
            socket.join(room);
            console.log(`${name} вошел в комнату ${room} как ${role}`);

            // Сообщение о роли игрока
            socket.emit('playerRole', { role });
            // Обновление списка игроков для всех в комнате
            io.to(room).emit('updatePlayers', rooms[room]);
        })
        
        socket.on('move', ({ index, player }) => {
            io.to(room).emit('moveMade', { index, player });
        });

        socket.on('restartGame', ({room}) => {
            io.to(room).emit('gemeRestarted');
        });
    
        socket.on('disconnect', () => {
            console.log('Игрок отключился:', socket.id);
        
            const room = socket.room; // Достаём номер комнаты
            if (room && rooms[room]) {
              rooms[room] = rooms[room].filter((player) => player.id !== socket.id);
        
              if (rooms[room].length === 0) {
                delete rooms[room];
                console.log(`Комната ${room} удалена.`);
              } else {
                io.to(room).emit('updatePlayers', rooms[room]);
              }
            }
          });
    });
  });
  

  const PORT = process.env.PORT || 8080;
  
  server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });
const rooms = {};

const createRoom = (room, gameMode) => {
  if (!rooms[room]) {
    rooms[room] = {
      gameMode,
      players: [],
      state: {
        squares: Array(9).fill(null),
        currentPlayer: 'X',
      },
    };
  }
};

const getRoom = (room) => rooms[room];

const addPlayerToRoom = (room, player) => {
  if (rooms[room]) {
    rooms[room].players.push(player);
  }
};

const removePlayerFromRoom = (room, playerId) => {
  if (rooms[room]) {
    rooms[room].players = rooms[room].players.filter((p) => p.id !== playerId);
    if (rooms[room].players.length === 0) {
      delete rooms[room];
    }
  }
};

export { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom };

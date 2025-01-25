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

const logRooms = () => {
  console.log('\n==== Current Rooms ====');
  
  Object.entries(rooms).forEach(([roomName, roomData]) => {
    console.log(`\nRoom: ${roomName}`);
    console.log('Game Mode:', roomData.gameMode);
    console.log('Players:');
    console.table(
      roomData.players.map(player => ({
        ID: player.id,
        Name: player.name,
        Role: player.role,
        Score: player.score,
      }))
    );
    console.log('State:');
    console.table([
      { Squares: JSON.stringify(roomData.state.squares), CurrentPlayer: roomData.state.currentPlayer },
    ]);
  });

  if (Object.keys(rooms).length === 0) {
    console.log('No active rooms.');
  }
  console.log('========================\n');
};

export { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom, logRooms };

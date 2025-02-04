import { definedRole, defineSkills } from "./utils.js";
const rooms = {};

const createRoom = (room, gameMode) => {
  if (!rooms[room]) {
    rooms[room] = {
      gameMode,
      aiMessages: [],
      moves: [],
      players: [],
      state: {
        squares: Array(9).fill(null),
        currentPlayer: 'X',
        locks: {}, // Состояние заблокированных клеток
      },
    };
  }
};

const getRoom = (room) => rooms[room];

const isPlayerExist = (room, name, playerId) => {
  const isExistInRoom = rooms[room].players.some((player) => player.id === playerId);
  if (isExistInRoom) {
    console.log(`Игрок ${name} уже зарегистрирован в комнате ${room}`);

  }
  return isExistInRoom;
}

const createPlayer = (id, name, players, gameMode) => {
  let role;
  if (gameMode === 'AI_Standard') {
    role = 'X'
  } else {
    role = definedRole(players);
  }
  
  const player = { id, name, role, score: 0 }
  if (gameMode === 'Half') {
    player.skills = defineSkills();
  }
  
  return player;
}

const addPlayerToRoom = (room, player) => {
  if (rooms[room]) {
    rooms[room].players.push(player);
  }
};

const removePlayerFromRoom = (room, playerId) => {
  if (rooms[room]) {
    rooms[room].players = rooms[room].players.filter((p) => p.id !== playerId);
    if (rooms[room].players.length === 0 || rooms[room].gameMode === 'AI_Standard' && rooms[room].players.length < 2) {
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
        Skills: player.skills
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

export { createRoom, getRoom, addPlayerToRoom, removePlayerFromRoom, isPlayerExist, createPlayer, logRooms };

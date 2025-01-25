// Отправка состояния комнаты
export const sendRoomState = (io, room, roomData, overrides = {}) => {
    io.to(room).emit('stateUpdated', {
      players: roomData.players,
      currentPlayer: roomData.state.currentPlayer,
      squares: roomData.state.squares,
      ...overrides,
    });
  };
  
  // Обработка победителя
  export const handleWinner = (io, room, roomData, gameResult) => {
    if (!gameResult || !gameResult.winner) {
      return sendRoomState(io, room, roomData, { winCombination: null, winner: null });
    }
  
    if (gameResult.winner === 'Ничья') {
      return sendRoomState(io, room, roomData, { winCombination: null, winner: 'Ничья' });
    }
  
    const winnerPlayer = roomData.players.find((p) => p.role === gameResult.winner);
    if (!winnerPlayer) return;
  
    if (roomData.gameMode === 'Standard') {
      return sendRoomState(io, room, roomData, {
        winCombination: gameResult.combination,
        winner: winnerPlayer.name,
      });
    }
  
    // Обновляем счёт игрока
    winnerPlayer.score += 1;
    if (winnerPlayer.score >= 3) {
      return sendRoomState(io, room, roomData, {
        winCombination: gameResult.combination,
        winner: winnerPlayer.name,
      });
    }
  
    // Выделяем выигрышную комбинацию
    sendRoomState(io, room, roomData, {
      winCombination: gameResult.combination,
      winner: winnerPlayer.name,
    });
  
    // Сброс выделения после задержки
    setTimeout(() => {
      gameResult.combination.forEach((index) => {
        roomData.state.squares[index] = null;
      });
      sendRoomState(io, room, roomData, { winCombination: null, winner: null });
    }, 1000);
  };
  
  // Сброс состояния комнаты
  export const resetRoomState = (roomData, saveScores = false) => {
    roomData.state.squares = Array(9).fill(null);
    roomData.state.currentPlayer = Math.random() > 0.5 ? 'X' : 'O';
    if (!saveScores) {
      roomData.players.forEach((player) => (player.score = 0));
    }
  };
  
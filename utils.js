export const calculateWinner = (squares, gameMode) => {
  const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
  ];

  if (gameMode === 'Half') {
      // Проверяем победителя в "Half" режиме
      for (const [a, b, c] of lines) {
          if ([a, b, c].every((index) => !squares[index]?.includes('HALF')) && squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
              return { winner: squares[a], combination: [a, b, c] };
          }
      }

      // Проверяем, если все клетки заняты и не содержат "HALF"
      if (squares.every((square) => square !== null && !square.includes('HALF'))) {
          return { winner: 'Ничья', combination: null };
      }

      // Проверка на запертую ситуацию
      const halfCells = squares.filter((square) => square?.includes('HALF'));
      const filledCells = squares.filter((square) => square !== null && !square.includes('HALF'));
      if (halfCells.length === 1 && filledCells.length === squares.length - 1) {
          return { winner: 'Ничья', combination: null };
      }
  } else if (gameMode === 'Standard') {
      // Проверяем победителя в обычном режиме
      for (const [a, b, c] of lines) {
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
            return { winner: squares[a], combination: [a, b, c] };
        }
      }
      if (squares.every((square) => square !== null)) {
        return { winner: 'Ничья', combination: null };
      }
  }

  return null;
};


export const definedRole = (roomPlayers) => {
    // Если нет игроков, случайно назначаем X или O
    if (roomPlayers.length === 0) {
      return Math.random() > 0.5 ? 'X' : 'O';
    }
  
    // Если один игрок уже есть, возвращаем противоположную роль
    if (roomPlayers.length === 1) {
      return roomPlayers[0].role === 'X' ? 'O' : 'X';
    }
  
    // Если уже два игрока, не назначаем роль (ошибка)
    throw new Error('Комната уже заполнена.');
  };
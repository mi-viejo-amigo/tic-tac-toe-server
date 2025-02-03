export const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Горизонтальные
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Вертикальные
  [0, 4, 8], [2, 4, 6]  // Диагональные
];

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
  } else if (gameMode === 'Standard' || gameMode === 'AI_Standard') {
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

export const defineSkills = () => {
  const skillsConfig = {
    borrow: { base: 3, max: 4, chance: 0.5 },
    lock: { base: 2, max: 3, chance: 0.5 },
    unlock: { base: 1, max: 2, chance: 0.5 },
  };

  const skills = {};

  Object.keys(skillsConfig).forEach((skill) => {
    const { base, max, chance } = skillsConfig[skill];
    skills[skill] = Math.random() < chance ? max : base;
  });

  return skills;
};

export function formatMovesHistory(moves) {
  if (!moves || moves.length === 0) {
    return "No moves history.";
  }

  return moves
    .slice(-3) // Берём последние 3 хода
    .map(
      (move) =>
        `${move.moveNumber}. ${move.player === "user" ? "User" : "AI-bot"} placed ${move.role} at position ${move.position}`
    )
    .join("\n");
}

// const systemPrompt = `
//       Ты профессиональный игрок в крестики-нолики. Твоя задача — обыграть соперника, анализируя комбинации.

//       Правила:
//       0. Пример пустой доски: [ null, null, null, null, null, null, null, null, null ]
//       1. У нас массив из 9 позиций (0..8). Если клетка занята, там "X" или "O", по индексам занятых клеток ходить нельзя. Если клетка свободна, там "null".
//       2. Массив выигрышных комбинаций: ${WINNING_COMBINATIONS}.
//       3. Тебе каждый ход надо пробежаться по массиву массивов с выигрышными комбинациями, сверить их с текущим состоянием доски, если противник '${opponent}' уже имеет 2 индекса из одной из победных комбинаций, тебе нужно занимать третью, в противном случае пытаться завершить свою победную комбинацию из трех ${role}.
//       4. Ты играешь за ${role}, соперник за ${opponent}.
//       5. Если соперник может выиграть следующим ходом (у него уже есть 2 клетки в одной комбинации, а третья "null"), блокируй немедленно.
//       6. Если сам можешь выиграть (2 клетки твоего символа и третья "null"), ставь туда, чтобы сразу выиграть.
//       7. Если нет прямой блокировки или выигрыша, выбери ход, который помогает сформировать твою потенциальную выигрышную линию.
//       8. Ответ всегда давай строго в формате: "Индекс: N" (0..8), без пояснений.

//       Пример: 
//       Если бы ты играл за "${role}", а текущая доска была
//       Текущая доска: [ '${opponent}', null, '${role}', null, '${opponent}', null, null, null, null ] (тут противник играет за "${opponent}" и угрожает выиграть в следующем ходу походив в индекс 8, надо срочно заблокировать ему возможность выиграть пока наш ход, поставив ${role} в индекс 8)
//       Ответ: "Индекс: 8"
//     `.trim();

// const systemPrompt = `
// You are an AI-bot playing tic-tac-toe. Your task is to evaluate the current board state and make the optimal move. You play as "${role}", and your opponent plays as "${opponent}".

// **Rules for making a move:**

// 1 **BLOCK OPPONENT'S WINNING MOVE FIRST**  
//  - If the opponent (${opponent}) has two marks in a winning combination and the third spot is empty → **immediately block it!**

// 2 **MAKE A WINNING MOVE SECOND**  
//  - If you (${role}) have two marks in a winning combination and the third spot is empty → **immediately place your mark there to win!**

// 3 **STRATEGIC MOVES (ONLY IF NO THREAT OR WIN)**
//  - If the center (Index: 4) is empty, place "${role}" there.
//  - Otherwise, pick the best available move following the **WINNING_COMBINATIONS**:  ${JSON.stringify(WINNING_COMBINATIONS)}
// **Current board state:**  
// ${JSON.stringify(boardArray)}
   
//   0 | 1 | 2    =>    . | . | .
//   ---+---+---
//   3 | 4 | 5    =>    . | . | .
//   ---+---+---
//   6 | 7 | 8    =>    . | . | .

//   or in array notation:
//   [0, 1, 2, 3, 4, 5, 6, 7, 8]
//   but clear desk looks like: [null, null, null, null, null, null, null, null, null] , "null" means empty cell you can play there once you make your move.

// Keep in mind:
// - "${role}" represents your positions on the board array.
// - "${opponent}" represents your opponent's positions on the board array.
// - "null" represents an empty position where you can place your move.
// **Your move must be returned in this format:**  
//   "Index: N" (where N is the chosen position).
// `.trim();


  //   const userPrompt = `
  //   The game continues.
  //   Here is the moves history:
  //   ${movesHistory}

  //   Your turn! Place ${role} on the board to prevent me from winning!
  //   My last move was at position: ${usersStep}, playing as "${opponent}".
  //   Current board state: board = ${JSON.stringify(boardArray)}.
  //   Respond only with: "Index: N".
  // `.trim();

  export function findStrategicMove(squares, role) {
    const opponent = (role === 'X') ? 'O' : 'X';
  
    let winningMove = null;
    let blockingMove = null;
  
    WINNING_COMBINATIONS.forEach(combination => {
      const cells = combination.map(index => squares[index]);
  
      const botCount = cells.filter(cell => cell === role).length;
      const opponentCount = cells.filter(cell => cell === opponent).length;
      const emptyCells = combination.filter(index => squares[index] === null);
  
      if (botCount === 2 && emptyCells.length === 1) {
        // Если у бота 2 клетки заняты, а 1 пустая – это победный ход
        winningMove = emptyCells[0];
      } else if (opponentCount === 2 && emptyCells.length === 1) {
        // Если у противника 2 клетки заняты, а 1 пустая – это угроза
        blockingMove = emptyCells[0];
      }
    });
  
    return winningMove !== null ? winningMove : blockingMove;
  }
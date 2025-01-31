export const WINNING_COMBINATIONS = JSON.stringify([
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Горизонтальные
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Вертикальные
  [0, 4, 8], [2, 4, 6]  // Диагональные
])

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
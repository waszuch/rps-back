const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } 
});

const PORT = process.env.PORT || 3001;


const roomMoves = {};


function determineWinner(move1, move2) {
  if (move1 === move2) return ["tie", "tie"];
  if (
    (move1 === 'rock' && move2 === 'scissors') ||
    (move1 === 'scissors' && move2 === 'paper') ||
    (move1 === 'paper' && move2 === 'rock')
  ) {
    return ["win", "lose"];
  }
  return ["lose", "win"];
}


io.on('connection', (socket) => {
  console.log('Nowe połączenie:', socket.id);

  
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`Gracz ${socket.id} dołączył do pokoju ${roomId}`);

    
    if (!roomMoves[roomId]) {
      roomMoves[roomId] = {};
    }
  });

  
  socket.on('move', ({ roomId, move }) => {
    console.log(`Gracz ${socket.id} w pokoju ${roomId} wykonał ruch: ${move}`);

    if (!roomMoves[roomId]) {
      roomMoves[roomId] = {};
    }
    roomMoves[roomId][socket.id] = move;

    
    const playersInRoom = Object.keys(roomMoves[roomId]);
    if (playersInRoom.length >= 2) {
      
      const [player1Id, player2Id] = playersInRoom;
      const move1 = roomMoves[roomId][player1Id];
      const move2 = roomMoves[roomId][player2Id];

      
      const [result1, result2] = determineWinner(move1, move2);
      console.log(`Wynik w pokoju ${roomId}: ${player1Id} (${move1}) vs ${player2Id} (${move2}) => ${result1} / ${result2}`);

      
      io.to(player1Id).emit('result', {
        yourMove: move1,
        opponentMove: move2,
        result: result1
      });
      io.to(player2Id).emit('result', {
        yourMove: move2,
        opponentMove: move1,
        result: result2
      });

      
      delete roomMoves[roomId][player1Id];
      delete roomMoves[roomId][player2Id];
    }
  });

  
  socket.on('disconnect', () => {
    console.log('Rozłączono:', socket.id);
    
    for (const roomId in roomMoves) {
      if (roomMoves[roomId][socket.id]) {
        delete roomMoves[roomId][socket.id];
      }
    }
  });
});


app.get('/', (req, res) => {
  res.send('Serwer z socket.io dla gry Rock-Paper-Scissors działa!');
});

server.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: ['https://rps-front-liart.vercel.app', 'http://localhost:5173','https://rps-back.onrender.com' ]
  }
});

const PORT = process.env.PORT || 3001;
// Zmieniamy URL frontendu na localhost
const FRONTEND_URL = 'https://rps-front-liart.vercel.app';

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

function generateRoomId() {
  return Math.random().toString(36).substr(2, 6);
}

io.on('connection', (socket) => {
  console.log('Nowe połączenie:', socket.id);

  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    socket.join(roomId);
    console.log(`Gracz ${socket.id} stworzył pokój ${roomId}`);
    
    if (!roomMoves[roomId]) {
      roomMoves[roomId] = {};
    }
    
    const roomLink = `${FRONTEND_URL}/waiting-room/${roomId}`;
    
    socket.emit('roomCreated', { roomId, link: roomLink });
  });

  socket.on('joinRoom', (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size >= 2) {
      console.log(`Pokój ${roomId} jest pełen – gracz ${socket.id} nie może dołączyć.`);
      socket.emit('roomFull', { message: 'Pokój jest już pełen' });
      return;
    }

    socket.join(roomId);
    console.log(`Gracz ${socket.id} dołączył do pokoju ${roomId}`);

    if (!roomMoves[roomId]) {
      roomMoves[roomId] = {};
    }

    socket.emit('joinSuccess', { roomId });

    if (io.sockets.adapter.rooms.get(roomId).size === 2) {
      console.log(`Pokój ${roomId} jest pełen. Wysyłanie sygnału bothPlayersJoined`);
      io.to(roomId).emit('bothPlayersJoined');
    }
  });

  socket.on('move', ({ roomId, move }) => {
    console.log(`Gracz ${socket.id} w pokoju ${roomId} wykonał ruch: ${move}`);
    
    if (!roomMoves[roomId]) {
      roomMoves[roomId] = {};
    }

    roomMoves[roomId][socket.id] = move;

    // Powiadom przeciwnika o ruchu
    socket.to(roomId).emit('opponentMoved');
    console.log(`Wysłano opponentMoved do przeciwnika w pokoju ${roomId}`);

    // Sprawdź czy obaj gracze wykonali ruch
    const playersInRoom = Object.keys(roomMoves[roomId]);
    if (playersInRoom.length >= 2) {
      const [player1Id, player2Id] = playersInRoom;
      const move1 = roomMoves[roomId][player1Id];
      const move2 = roomMoves[roomId][player2Id];

      // Upewnij się, że obaj gracze wykonali ruch
      if (move1 && move2) {
        console.log(`Obaj gracze wykonali ruchy: ${player1Id}=${move1}, ${player2Id}=${move2}`);
        const [result1, result2] = determineWinner(move1, move2);

        console.log(`Wynik: ${player1Id}=${result1}, ${player2Id}=${result2}`);
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

        // Reset ruchów w pokoju
        delete roomMoves[roomId][player1Id];
        delete roomMoves[roomId][player2Id];
      }
    }
  });

  socket.on('requestRematch', ({ roomId }) => {
    console.log(`Gracz ${socket.id} prosi o rewanż w pokoju ${roomId}`);
    socket.to(roomId).emit('rematchRequested');
    console.log(`Wysłano rematchRequested do przeciwnika w pokoju ${roomId}`);
  });

  socket.on('acceptRematch', ({ roomId }) => {
    console.log(`Gracz ${socket.id} zaakceptował rewanż w pokoju ${roomId}`);
    if (roomMoves[roomId]) roomMoves[roomId] = {};
    io.to(roomId).emit('rematchAccepted');
    console.log(`Wysłano rematchAccepted do obu graczy w pokoju ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('Rozłączono:', socket.id);
    
    // Znajdź pokoje, w których był gracz
    for (const roomId in roomMoves) {
      if (roomMoves[roomId][socket.id]) {
        console.log(`Gracz ${socket.id} opuścił pokój ${roomId}`);
        delete roomMoves[roomId][socket.id];
      }
      
      // Powiadom pozostałego gracza
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size === 1) {
        console.log(`Wysyłanie opponentLeft do pozostałego gracza w pokoju ${roomId}`);
        socket.to(roomId).emit('opponentLeft');
      }
    }
  });
});

app.get('/', (req, res) => {
  res.send('Serwer z socket.io dla gry Rock-Paper-Scissors działa!');
});

server.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
  console.log(`Akceptuje połączenia z: http://localhost:5173`);
});
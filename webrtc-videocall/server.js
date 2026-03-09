import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// roomId -> Set<ws>
const rooms = new Map();

function broadcast(roomId, sender, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const client of room) {
    if (client !== sender && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  }
}

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, roomId } = msg;

    switch (type) {
      case 'join': {
        if (!roomId) {
          ws.send(JSON.stringify({ type: 'error', message: 'roomId is required' }));
          return;
        }

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }

        const room = rooms.get(roomId);

        if (room.size >= 2) {
          ws.send(JSON.stringify({ type: 'full', roomId }));
          return;
        }

        room.add(ws);
        currentRoom = roomId;

        const role = room.size === 1 ? 'caller' : 'callee';

        ws.send(JSON.stringify({
          type: 'joined',
          roomId,
          role,
          participants: room.size,
        }));

        // Notify the other participant that someone joined
        if (room.size === 2) {
          broadcast(roomId, ws, {
            type: 'peer-joined',
            roomId,
          });
        }

        console.log(`[room:${roomId}] ${role} joined (${room.size}/2)`);
        break;
      }

      case 'offer':
      case 'answer':
      case 'candidate': {
        broadcast(msg.roomId || currentRoom, ws, msg);
        break;
      }

      case 'hangup': {
        const rid = msg.roomId || currentRoom;
        broadcast(rid, ws, { type: 'hangup', roomId: rid });
        break;
      }

      default:
        console.log(`[unknown] type: ${type}`);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.delete(ws);

      // Notify remaining participant
      broadcast(currentRoom, ws, {
        type: 'peer-left',
        roomId: currentRoom,
      });

      if (room.size === 0) {
        rooms.delete(currentRoom);
      }

      console.log(`[room:${currentRoom}] participant left (${room.size}/2)`);
    }
  });
});

console.log(`✦ Signaling server running on ws://0.0.0.0:${PORT}`);

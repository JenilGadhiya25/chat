# Real-Time Chat App

Full-stack chat application built with React, Node.js, Socket.io, and MongoDB.

## Quick Start

### 1. Server setup
```bash
cd server
npm install
cp .env.example .env   # fill in your values
npm run dev
```

### 2. Client setup
```bash
cd client
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

### Server (`server/.env`)
| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `CLIENT_URL` | Frontend URL (for CORS) |
| `CLOUDINARY_*` | Cloudinary credentials for media uploads |

### Client (`client/.env`)
| Variable | Description |
|---|---|
| `VITE_SERVER_URL` | Backend URL |

## Features
- JWT authentication (register/login)
- Real-time messaging via Socket.io
- Online/offline status
- Typing indicators
- Media sharing (images, videos, files via Cloudinary)
- Message edit & delete
- Group chats
- Emoji picker
- Dark/light mode
- Message seen/delivered status
- Sound notifications

## Deployment
- **Frontend**: Deploy `client/` to Vercel — set `VITE_SERVER_URL` to your backend URL
- **Backend**: Deploy `server/` to Render/Railway — set all env vars in the dashboard

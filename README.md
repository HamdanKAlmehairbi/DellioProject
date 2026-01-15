# Dellio 🎤

An AI-powered interview practice platform that helps users improve their interview skills through realistic, AI-conducted mock interviews. Built with Next.js, FastAPI, and OpenAI's GPT-4.

##  Demo

Watch the demo video to see Dellio in action:

[![Dellio Demo](https://img.youtube.com/vi/pjY6ScbvhGU/0.jpg)](https://www.youtube.com/watch?v=pjY6ScbvhGU)

**Direct Link:** https://www.youtube.com/watch?v=pjY6ScbvhGU

##  Features

- **AI-Powered Interviews**: Conduct realistic mock interviews using GPT-4
- **Real-time Conversation**: WebSocket-based real-time audio conversation with the AI interviewer
- **Voice Interaction**: Speech-to-text and text-to-speech capabilities for natural conversation flow
- **Resume & Job Description Analysis**: Upload your resume and job description to generate personalized interview questions
- **Google OAuth Integration**: Secure authentication with Google Sign-In
- **Interview Queue System**: Manage concurrent users with a queue system
- **Session Management**: JWT-based authentication with refresh tokens
- **Conversation History**: Store and retrieve interview conversations

##  Tech Stack

### Frontend
- **Next.js 18** - React framework
- **NextAuth.js** - Authentication
- **Tailwind CSS** - Styling
- **WebSocket** - Real-time communication
- **React Audio Voice Recorder** - Audio recording

### Backend
- **FastAPI** - Python web framework
- **OpenAI GPT-4** - AI interview generation
- **Anthropic Claude** - Fallback AI model
- **Deepseek** - Alternative AI model
- **MongoDB** - Database for conversation storage
- **Redis** - Caching and session management
- **WebSockets** - Real-time bidirectional communication
- **JWT** - Token-based authentication

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

##  Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (3.11 or higher)
- **Docker** and **Docker Compose** (optional, for containerized deployment)
- **Redis** (can use Redis Cloud or local Redis instance)
- **MongoDB** (MongoDB Atlas or local MongoDB instance)
- **FFmpeg** (for audio processing)

### API Keys Required

- **OpenAI API Key** - For GPT-4 and Whisper
- **Anthropic API Key** (optional) - For Claude fallback
- **Deepseek API Key** (optional) - Alternative AI model
- **Google OAuth Credentials** - For Google Sign-In

##  Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/HamdanKAlmehairbi/DellioProject.git
cd DellioProject
```

### 2. Set Up Redis

#### Option A: Redis Cloud (Recommended for Production)

1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a new database
3. Note down your Redis connection details:
   - Host
   - Port
   - Username
   - Password

#### Option B: Local Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server
```

### 3. Set Up MongoDB

#### Option A: MongoDB Atlas (Recommended)

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address
5. Get your connection string

#### Option B: Local MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 mongo:latest

# Or install locally
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb
```

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://your-domain.com/api/auth/callback/google` (for production)
6. Save your Client ID and Client Secret

### 5. Configure Environment Variables

#### Backend Environment Variables

Create a `.env` file in the `BackEnd/` directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration (Optional - for Claude fallback)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Deepseek Configuration (Optional - alternative AI model)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Redis Configuration
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_password

# JWT & Security
SECRET_KEY=your_secret_key_here_generate_a_random_string
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_ISSUER=http://localhost:8000

# Application URLs
NEXTAUTH_URL=http://localhost:3000
```

#### Frontend Environment Variables

Create a `.env.local` file in the `FrontEnd/` directory:

```env
# Backend API Configuration
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here_generate_a_random_string

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Note:** Generate secure random strings for `SECRET_KEY`, `JWT_SECRET_KEY`, and `NEXTAUTH_SECRET`. You can use:

```bash
# Generate random secret (Linux/Mac)
openssl rand -base64 32

# Or use an online generator
```

### 6. Install Dependencies

#### Backend

```bash
cd BackEnd
pip install -r requirements.txt
```

**Note:** On some systems, you may need to install system dependencies:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y ffmpeg python3-dev build-essential libmagic1

# macOS
brew install ffmpeg
```

#### Frontend

```bash
cd FrontEnd
npm install
```

### 7. Run the Application

#### Option A: Using Docker Compose (Recommended)

```bash
# From the root directory
docker-compose up --build
```

This will start:
- Backend on `http://localhost:8000`
- Frontend on `http://localhost:3000`
- Redis on `localhost:6379`

#### Option B: Manual Setup

**Terminal 1 - Backend:**

```bash
cd BackEnd
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend API docs will be available at: `http://localhost:8000/docs`

**Terminal 2 - Frontend:**

```bash
cd FrontEnd
npm run dev
```

Frontend will be available at: `http://localhost:3000`

### 8. Access the Application

1. Open your browser and navigate to `http://localhost:3000`
2. Sign in with Google OAuth
3. Upload your resume and job description
4. Start your AI-powered interview!

##  Project Structure

```
InterviewAI-main/
├── BackEnd/                 # FastAPI backend
│   ├── main.py             # Main FastAPI application
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile         # Backend container config
│   ├── .env               # Backend environment variables
│   └── ...                # Other backend modules
├── FrontEnd/               # Next.js frontend
│   ├── pages/             # Next.js pages
│   ├── components/        # React components
│   ├── styles/            # CSS modules
│   ├── public/            # Static assets
│   ├── package.json       # Node dependencies
│   ├── Dockerfile         # Frontend container config
│   └── .env.local         # Frontend environment variables
├── docker-compose.yml      # Docker Compose configuration
└── README.md              # This file
```

##  Configuration

### Backend Configuration

- **Port**: 8000 (configurable in `docker-compose.yml`)
- **CORS**: Configured for `localhost:3000` and `frontend:3000`
- **WebSocket**: Available at `/ws/interview`

### Frontend Configuration

- **Port**: 3000 (configurable in `docker-compose.yml`)
- **API Endpoint**: Configured via `NEXT_PUBLIC_BACKEND_URL`
- **WebSocket Endpoint**: Configured via `NEXT_PUBLIC_WS_URL`

##  Testing

### Backend API Testing

Visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI).

### Health Check

```bash
curl http://localhost:8000/health
```

##  Troubleshooting

### Backend Issues

1. **MongoDB Connection Failed**
   - Verify `MONGODB_URI` is correct
   - Check MongoDB Atlas IP whitelist
   - Ensure MongoDB service is running

2. **Redis Connection Failed**
   - Verify Redis credentials
   - Check Redis host and port
   - Ensure Redis service is running

3. **OpenAI API Errors**
   - Verify `OPENAI_API_KEY` is valid
   - Check API quota and billing

4. **FFmpeg Not Found**
   - Install FFmpeg: `brew install ffmpeg` (Mac) or `apt-get install ffmpeg` (Linux)

### Frontend Issues

1. **Cannot Connect to Backend**
   - Verify `NEXT_PUBLIC_BACKEND_URL` is correct
   - Ensure backend is running on port 8000
   - Check CORS configuration

2. **Google OAuth Not Working**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Check redirect URIs in Google Cloud Console
   - Ensure `NEXTAUTH_URL` matches your domain

3. **WebSocket Connection Failed**
   - Verify `NEXT_PUBLIC_WS_URL` is correct
   - Check backend WebSocket endpoint is accessible

##  API Endpoints

### Authentication
- `POST /generate-token` - Generate JWT tokens
- `POST /refresh-token` - Refresh access token

### Interview Management
- `POST /process-documents` - Process resume and job description
- `POST /start-interview` - Start interview session
- `GET /check-interview-time` - Check interview status
- `POST /end-interview` - End interview session
- `DELETE /clear-interview/{user_id}` - Clear interview data

### Queue Management
- `POST /join-interview-queue` - Join interview queue
- `POST /leave-interview` - Leave interview queue
- `GET /queue-status` - Get queue status

### WebSocket
- `WS /ws/interview?token={token}&user_id={user_id}&new_session={bool}` - Interview WebSocket connection

##  Security

- All API keys and secrets are stored in environment variables (never commit `.env` files)
- JWT tokens with refresh token support
- CORS configured for specific origins
- Environment variables validated on startup
- No hardcoded credentials in source code

##  License

This project is private and proprietary.

##  Author

**Hamdan Almehairbi**

Solo developer and creator of Dellio.

---

##  Acknowledgments

- OpenAI for GPT-4 and Whisper APIs
- Anthropic for Claude API
- Next.js and FastAPI communities
- All open-source contributors whose libraries made this project possible

---



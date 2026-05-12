# Clynicx

Clynicx is a comprehensive full-stack application leveraging modern web technologies and AI to manage clinical data, appointments, and provide intelligent chatbot assistance. The application utilizes a multi-agent framework powered by CrewAI and Groq for intelligent AI reasoning and processing.

## 🚀 Tech Stack

### Frontend
- **Framework:** React with TypeScript (Vite)
- **Styling:** Tailwind CSS / Custom UI components

### Backend
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL with `pgvector` for vector storage and search
- **AI Framework:** CrewAI, Groq, LiteLLM

### Infrastructure
- **Containerization:** Docker & Docker Compose

## 📁 Project Structure

- `/frontend` - React + Vite frontend application
- `/backend` - FastAPI application, CrewAI agents, and tools
- `docker-compose.yml` - Orchestration for frontend, backend, and PostgreSQL Database

## 🛠️ Setup & Installation

Ensure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.

### 1. Environment Variables

Create `.env` file in the `backend` directory using the provided examples or your own credentials:

```bash
# Example backend/.env
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_jwt_secret_key
```

### 2. Build and Run via Docker Compose

Run the following command in the root directory:

```bash
docker-compose up -d --build
```
This will start:
- PostgreSQL database at `localhost:5432`
- FastAPI backend at `localhost:3001`
- React frontend at `localhost:5173`

*(Alternatively, you can run `start.bat` on Windows from the root directory).*

### 3. Accessing the App

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (Swagger):** [http://localhost:3001/docs](http://localhost:3001/docs)

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

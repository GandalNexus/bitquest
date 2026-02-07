# BitQuest

![Bitcoin](https://img.shields.io/badge/Bitcoin-FF9900?style=flat-square&logo=bitcoin&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg?style=flat-square)

**A gamified educational platform to learn Bitcoin and the Lightning Network.**

## Overview

BitQuest is an interactive web application designed to transform Bitcoin education into an engaging experience. Users progress through educational quests, earn rewards, unlocks achievements, and master the fundamentals of Bitcoin and the Lightning Network through a structured, gamified learning path.

## Key Features

### Authentication and Security
-   Secure user registration and login using bcrypt hashing.
-   Session management via httpOnly cookies.
-   Route protection implemented with Next.js middleware.

### Gamification Engine
-   **Leveling System**: Users gain XP and level up by completing educational tasks.
-   **Virtual Economy**: An educational wallet system simulating satoshis (testnet).
-   **Achievements**: Badge system to track and reward progress.
-   **Progressive Difficulty**: Curated quests ranging from beginner to expert concepts.

### User Dashboard
-   Comprehensive progress tracking.
-   Real-time statistics and user metrics.
-   Transaction history visualization.
-   Personalized learning paths.

### User Interface
-   Responsive design compatible with desktop and mobile devices.
-   Dark mode support.
-   Optimized for performance and accessibility.

## Technology Stack

### Frontend
-   **Next.js 16**: React framework utilizing the App Router architecture.
-   **React 19**: Library for building user interfaces.
-   **TypeScript**: Statically typed JavaScript for improved maintainability.
-   **Tailwind CSS 4**: Utility-first CSS framework for styling.
-   **Lucide React**: Icon library.

### Backend and Database
-   **Next.js Server Actions**: Server-side logic and API handling.
-   **Drizzle ORM**: TypeScript-first Object Relational Mapper.
-   **PostgreSQL**: Relational database management system.
-   **bcryptjs**: Library for secure password hashing.

## Getting Started

### Prerequisites
Ensure the following are installed in your development environment:
-   Node.js 18 or higher
-   Docker and Docker Compose
-   npm or yarn package manager

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/bitquest.git
    cd bitquest
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure environment variables**
    ```bash
    cp .env.example .env
    ```
    The `.env` file comes pre-configured for the local Docker environment:
    ```env
    DATABASE_URL="postgresql://bitquest:bitquest_dev_password@localhost:5432/bitquest"
    NODE_ENV="development"
    ```

4.  **Initialize the Database**
    Start the PostgreSQL container and apply the schema:
    ```bash
    npm run db:start
    npm run db:push
    ```

5.  **Start the Development Server**
    ```bash
    npm run dev
    ```
    Access the application at [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds the application for production. |
| `npm run start` | Starts the production server. |
| `npm run lint` | Runs the linter to ensure code quality. |
| `npm run db:start` | Starts the PostgreSQL database via Docker. |
| `npm run db:stop` | Stops the PostgreSQL database container. |
| `npm run db:reset` | Resets the database (CAUTION: deletes data). |
| `npm run db:push` | Pushes schema changes to the database. |
| `npm run db:studio` | Opens Drizzle Studio for database management. |

For detailed Docker instructions, refer to `DOCKER.md`.

## Project Structure

```
bitquest/
├── app/
│   ├── actions/          # Server Actions (backend logic)
│   ├── dashboard/        # Dashboard route and components
│   ├── login/            # Authentication routes
│   ├── signup/           # Registration routes
│   ├── layout.tsx        # Root layout definition
│   └── page.tsx          # Landing page
├── components/           # Reusable UI components
│   ├── DashboardShell.tsx
│   └── PublicLayout.tsx
├── db/                   # Database configuration
│   ├── index.ts          # Drizzle client setup
│   └── schema.ts         # Database schema definitions
├── public/               # Static assets (images, fonts)
├── middleware.ts         # Authentication middleware
└── package.json          # Project dependencies and scripts
```

## Database Schema

The core user table structure is defined as follows:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  sats INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Roadmap

-   [x] Authentication system
-   [x] Interactive dashboard
-   [x] Quest system foundation
-   [x] Educational wallet
-   [x] Achievement system
-   [ ] Advanced interactive quests
-   [ ] Lightning Network integration (testnet)
-   [ ] Leaderboards and competitive features
-   [ ] Multiplayer capabilities
-   [ ] Public API

## Contributing

Contributions are welcome. Please follow the standard workflow:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/NewFeature`).
3.  Commit your changes (`git commit -m 'Add NewFeature'`).
4.  Push to the branch (`git push origin feature/NewFeature`).
5.  Open a Pull Request.

Please ensure all code adheres to the project's TypeScript conventions and includes appropriate tests.

## License

This project is licensed under the AGPL-3.0 License. See the [LICENSE](LICENSE) file for details.

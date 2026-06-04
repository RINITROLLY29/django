"# todo-repo" 

# Todo App (React + Django)

A simple drag-and-drop Todo application built using React for the frontend and Django REST Framework for the backend.  
It supports task tracking, time tracking, and a recycle bin for deleted tasks.

---

## Features

- Add / delete / restore tasks
- Drag and drop tasks between:
  - Todo
  - In Progress
  - Done
  - Delete
  - Archive
- Live timer for tasks in progress
- Total time tracking for completed tasks
- Recycle bin with restore and permanent delete
- Undo option for recently deleted tasks

---

## Tech Stack

**Frontend**
- React
- Axios
- @hello-pangea/dnd (drag and drop)

**Backend**
- Django
- Django REST Framework
- SQLite (default database)

---

## How it works

- Tasks are fetched from Django REST API  
- React handles UI updates and drag-drop interactions  
- Tasks move between columns (Todo / In Progress / Done / Delete/ Archive) via API updates  
- Timer runs only for "In Progress" tasks  
- Completed tasks store total time spent and display it in readable format  
- Archive works like a soft delete — tasks are moved out of active workflow but can be restored anytime  
- Recycle Bin stores deleted tasks temporarily with options to restore or permanently delete  
- Collaboration system allows users to share a todo board and work together using request-based access  
- Notifications handle collaboration requests and show accept/reject status updates in real time
---

## Project Structure

---

## API Endpoints

| Method | Endpoint            | Description        |
|--------|--------------------|--------------------|
| GET    | /api/todos/        | Get all tasks      |
| POST   | /api/todos/        | Create task        |
| PATCH  | /api/todos/:id/    | Update task        |
| DELETE | /api/todos/:id/   | Delete task        |

---

## Setup Instructions

### Backend

```bash
cd backend
python manage.py migrate
python manage.py runserver


cd frontend
npm install
npm start

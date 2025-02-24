import React, { useEffect } from "react";
import SearchBar from "./components/SearchBar.tsx";
import KanbanBoard from "./components/KanbanBoard.tsx";

function App() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-4">Kanban Board</h1>
      <SearchBar />
      <KanbanBoard />
    </div>
  );
}

export default App;

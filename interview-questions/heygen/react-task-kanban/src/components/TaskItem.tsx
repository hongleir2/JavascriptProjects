import React, { useState } from "react";
import { Task } from "../types";
import { useKanbanStore } from "../store/useKanbanStore.ts";
import EditTaskModal from "./EditTaskModal.tsx";
interface Props {
  task: Task;
  isInSprint: boolean;
}
const TaskItem: React.FC<Props> = ({ task, isInSprint }) => {
  const { addTaskToSprint, removeTaskFromSprint } = useKanbanStore();
  const [isEditing, setIsEditing] = useState(false);

  const handleAdd = () => {
    // Add task to sprint
    addTaskToSprint(task);
  };
  const handleRemove = () => {
    // Remove task from sprint
    if (window.confirm("Are you sure you want to remove this task?")) {
      removeTaskFromSprint(task.id);
    }
  };
  return (
    <li className="border-b border-gray-200 p-2 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-medium">{task.title}</h3>
        <p className="text-sm text-gray-600">{task.description}</p>
      </div>
      <div className="flex space-x-2">
        {isInSprint ? (
          <>
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            <button
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              onClick={handleRemove}
            >
              Remove
            </button>
          </>
        ) : (
          <button
            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600"
            onClick={handleAdd}
          >
            Add
          </button>
        )}
      </div>
      {isEditing && (
        <EditTaskModal task={task} onClose={() => setIsEditing(false)} />
      )}
    </li>
  );
};

export default TaskItem;

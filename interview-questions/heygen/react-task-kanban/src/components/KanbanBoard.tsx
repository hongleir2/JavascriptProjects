import React, { useEffect } from "react";
import { useKanbanStore } from "../store/useKanbanStore.ts";
import TaskItem from "./TaskItem.tsx";

const KanbanBoard: React.FC = () => {
  const { sprintTasks, fetchSprintTasks } = useKanbanStore();

  useEffect(() => {
    fetchSprintTasks();
  }, [fetchSprintTasks]);

  return (
    <div className="mt-8">
      <h2 className="text-xl">Current Sprint</h2>
      {sprintTasks.length === 0 ? (
        <p>No task in current sprint</p>
      ) : (
        <ul>
          {sprintTasks.map((task) => (
            <TaskItem key={task.id} task={task} isInSprint={true} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default KanbanBoard;

import React from "react";
import { Task } from "../types";
import TaskItem from "./TaskItem.tsx";

interface TaskListProps {
  tasks: Task[];
}

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  return (
    <div>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} isInSprint={false} />
      ))}
    </div>
  );
};

export default TaskList;

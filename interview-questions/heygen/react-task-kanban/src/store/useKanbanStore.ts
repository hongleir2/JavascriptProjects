import { create } from "zustand";
import { Task } from "../types";
import { LOCALHOST } from "../const.ts";

interface KanbanState {
  sprintTasks: Task[];
  fetchSprintTasks: () => Promise<void>;
  addTaskToSprint: (task: Task) => Promise<void>;
  removeTaskFromSprint: (taskId: number) => Promise<void>;
  updateTask: (taskId: number, updatedTask: Partial<Task>) => Promise<void>;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  sprintTasks: [],
  fetchSprintTasks: async () => {
    // Fetch tasks from API and update the sprintTasks state
    try {
      const response = await fetch(`${LOCALHOST}/current_sprint`);
      const data: Task[] = await response.json();
      set({ sprintTasks: data });
    } catch (error) {
      console.error("Error fetching sprint tasks:", error);
    }
  },
  addTaskToSprint: async (task: Task) => {
    // Add task to sprint and update the sprintTasks state
    const { sprintTasks } = get();

    // Check if task already exists in sprintTasks
    if (sprintTasks.find((t) => t.id === task.id)) return;
    try {
      const response = await fetch(`${LOCALHOST}/current_sprint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(task),
      });
      const newTask: Task = await response.json();
      set({ sprintTasks: [...sprintTasks, newTask] });
    } catch (error) {
      console.error("Error adding task to sprint:", error);
    }
  },
  removeTaskFromSprint: async (taskId: number) => {
    // Remove task from sprint and update the sprintTasks state
    try {
      const { sprintTasks } = get();
      const response = await fetch(`${LOCALHOST}/current_sprint/${taskId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        set({
          sprintTasks: sprintTasks.filter((task) => task.id !== taskId),
        });
      } else {
        throw new Error("Failed to remove task from sprint");
      }
    } catch (error) {
      console.error("Error removing task from sprint:", error);
    }
  },
  updateTask: async (taskId: number, updatedTask: Partial<Task>) => {
    // Update task in sprint and update the sprintTasks state
    try {
      const response = await fetch(`${LOCALHOST}/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedTask),
      });
      const updatedTaskData: Task = await response.json();
      set({
        sprintTasks: get().sprintTasks.map((task) =>
          task.id === taskId ? updatedTaskData : task
        ),
      });
    } catch (error) {
      console.error("Error updating task:", error);
    }
  },
}));
